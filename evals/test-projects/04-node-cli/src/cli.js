import { Command } from "commander";

export function run(argv) {
  const program = new Command();
  program.name("tool").description("").version("0.1.0");
  program.parse(argv);
}
