# PM2 Startup & Persistence

These notes explain how to configure PM2 so the Next.js server and automation processes are restored after a server reboot.

1. Install PM2 globally on the host (as the runtime user):

   sudo npm i -g pm2

2. Start your app with PM2 (example):

   pm2 start server.mjs --name automation-ui --node-args="--expose-gc"

3. Ensure the watchdog is running (it will be created by the app with our helper):

   node ./scripts/pm2-ensure-watchdog.js

4. Save the PM2 process list so it will be resurrected after reboot:

   pm2 save

5. Generate and execute the startup script for your platform (systemd example):

   sudo pm2 startup systemd -u <username> --hp /home/<username>

   This prints a command to execute as root; run the printed command.

6. Verify persistence:

   sudo reboot
   After reboot, run:
   pm2 ls
   You should see the processes you saved earlier.

Notes & Security:

- Running `pm2 startup` must be performed by an operator with sudo/root permissions.
- Do not expose PM2's API socket to untrusted networks.
- Use `pm2 save` whenever you make configuration changes to ensure persistence.
