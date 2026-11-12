// Native "choose folder" dialog, like VS Code's Open Folder. The server runs on the user's machine, so it can show one.
// Windows: the modern Explorer dialog (IFileOpenDialog + FOS_PICKFOLDERS). macOS: osascript. Linux: zenity or kdialog.
import { spawn } from "node:child_process";
import { which } from "./agents.mjs";

const WIN_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ClearspecFolderPicker {
  [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FileOpenDialogRCW {}
  [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileDialog {
    [PreserveSig] int Show(IntPtr parent);
    void SetFileTypes(uint c, IntPtr f); void SetFileTypeIndex(uint i); void GetFileTypeIndex(out uint i);
    void Advise(IntPtr p, out uint c); void Unadvise(uint c);
    void SetOptions(uint fos); void GetOptions(out uint fos);
    void SetDefaultFolder(IShellItem si); void SetFolder(IShellItem si);
    void GetFolder(out IShellItem si); void GetCurrentSelection(out IShellItem si);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string n); void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string n);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void GetResult(out IShellItem si);
  }
  [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetParent(out IShellItem si);
    void GetDisplayName(uint sigdn, [MarshalAs(UnmanagedType.LPWStr)] out string name);
    void GetAttributes(uint mask, out uint attrs);
    void Compare(IShellItem si, uint hint, out int order);
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, ref Guid riid, out IShellItem item);

  public static string Pick(IntPtr owner, string start) {
    var dlg = (IFileDialog)new FileOpenDialogRCW();
    dlg.SetOptions(0x20 | 0x40 | 0x800); // PICKFOLDERS | FORCEFILESYSTEM | PATHMUSTEXIST
    dlg.SetTitle("Choose the project folder");
    dlg.SetOkButtonLabel("Select folder");
    if (!string.IsNullOrEmpty(start) && System.IO.Directory.Exists(start)) {
      try { var iid = typeof(IShellItem).GUID; IShellItem si; SHCreateItemFromParsingName(start, IntPtr.Zero, ref iid, out si); dlg.SetFolder(si); } catch {}
    }
    int hr = dlg.Show(owner);
    if (hr != 0) return null; // cancelled
    IShellItem result; dlg.GetResult(out result);
    string path; result.GetDisplayName(0x80058000, out path); // SIGDN_FILESYSPATH
    return path;
  }
}
'@
$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false; Opacity = 0; StartPosition = 'CenterScreen'; Width = 1; Height = 1 }
$owner.Show(); $owner.Activate()
try { $p = [ClearspecFolderPicker]::Pick($owner.Handle, $env:CLEARSPEC_START) } finally { $owner.Close() }
if ($p) { [Console]::Out.Write($p) }
`;

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, windowsHide: false });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

let busy = false;

/** Resolves { path } or { cancelled: true }; throws when no dialog is available. */
export async function pickFolder(start = "") {
  if (busy) throw new Error("A folder dialog is already open.");
  busy = true;
  try {
    let r;
    if (process.platform === "win32") {
      const encoded = Buffer.from(WIN_SCRIPT, "utf16le").toString("base64");
      r = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], { CLEARSPEC_START: start });
      if (r.code !== 0) throw new Error(r.err.split("\n")[0] || "The folder dialog failed.");
    } else if (process.platform === "darwin") {
      const loc = start ? ` default location (POSIX file ${JSON.stringify(start)})` : "";
      r = await run("osascript", ["-e", `POSIX path of (choose folder with prompt "Choose the project folder"${loc})`]);
      if (r.code !== 0) return { cancelled: true }; // osascript exits 1 on cancel
    } else if (which("zenity")) {
      r = await run("zenity", ["--file-selection", "--directory", "--title=Choose the project folder", ...(start ? [`--filename=${start}/`] : [])]);
    } else if (which("kdialog")) {
      r = await run("kdialog", ["--getexistingdirectory", start || process.env.HOME || "/"]);
    } else {
      throw new Error("No folder dialog available (install zenity or kdialog). Type the path instead.");
    }
    return r.out ? { path: r.out.replace(/\/$/, "") || "/" } : { cancelled: true };
  } finally {
    busy = false;
  }
}
