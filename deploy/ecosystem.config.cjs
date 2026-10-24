// pm2 process for gpu-unlock.com.
//
// cwd is the standalone tree, exactly like the stratat deploy: server.js resolves
// `.next` relative to its own location, so the process must be started from there.
module.exports = {
  apps: [
    {
      name: "gpu-unlock",
      cwd: "/opt/gpu-unlock/.next/standalone",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: "3200",
        HOSTNAME: "127.0.0.1",
      },
      max_memory_restart: "512M",
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
