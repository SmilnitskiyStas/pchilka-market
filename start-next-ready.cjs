const { spawn } = require("child_process");

  const raw = process.argv.slice(2);
  const nextArgs = ["start"];

  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];

    if (a === "--host" && raw[i + 1]) {
      nextArgs.push("--hostname", raw[i + 1]);
      i++;
      continue;
    }

    if (a.startsWith("--host=")) {
      nextArgs.push("--hostname", a.split("=")[1]);
      continue;
    }

    nextArgs.push(a);
  }

  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, ...nextArgs], { stdio: "inherit" });

  child.on("exit", (code) => process.exit(code ?? 1));