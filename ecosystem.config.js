module.exports = {
  apps: [
    {
      name: "alpha-reminder",
      cwd: __dirname,
      script: "src/cli.js",
      args: "run",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 5000,
      watch: false,
      out_file: "logs/alpha-reminder-out.log",
      error_file: "logs/alpha-reminder-error.log"
    }
  ]
};
