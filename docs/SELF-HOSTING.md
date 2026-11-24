# Self-hosting Baloney

Baloney is a single Node process with one JSON file. Anything that runs Node 20+
can host it.

## 1. Create the Discord application

1. Open <https://discord.com/developers/applications> and choose *New
   Application*.
2. *Bot* → *Reset Token* → copy the token into `DISCORD_TOKEN`.
3. *General Information* → *Application ID* → copy it into `CLIENT_ID`.
4. Leave every **Privileged Gateway Intent** off. Baloney only uses `Guilds`.

## 2. Configure

```bash
cp .env.example .env
```

| variable | required | purpose |
|---|---|---|
| `DISCORD_TOKEN` | yes | bot token |
| `CLIENT_ID` | yes for invite links | application id |
| `GUILD_ID` | no | register commands instantly in one server while developing |
| `OWNER_ID` | no | Discord user id allowed to run `/debug` |
| `DATA_FILE` | no | stats path, default `data/stats.json` |

## 3. Register and run

```bash
npm ci --omit=dev
npm run deploy
npm start
```

`npm run deploy` registers all 21 commands. With `GUILD_ID` set it is instant;
without it, global commands can take up to an hour to appear.

Check the setup at any time:

```bash
npm run doctor
```

It prints the invite URL, the four permissions, the permission integer and the
size of every content bank.

## 4. Keep it running

### systemd

```ini
[Unit]
Description=Baloney Discord party bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=baloney
WorkingDirectory=/opt/baloney
EnvironmentFile=/opt/baloney/.env
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now baloney
journalctl -u baloney -f
```

### Docker

```bash
cp .env.example .env      # fill it in
docker compose run --rm baloney npm run deploy
docker compose up -d
docker compose logs -f
```

The compose file mounts `./data` at `/app/data`, so stats survive rebuilds. The
container runs as the unprivileged `node` user and needs outbound HTTPS only.

### Free PaaS tiers

Railway, Render, Fly and similar work. The important part is a **persistent
volume** mounted at the directory that holds `DATA_FILE`; otherwise stats reset
on every deploy. Games are in memory and will end on restart either way.

## Backups

Copy `data/stats.json`. Baloney keeps a one-generation `stats.json.bak` next to
it and writes atomically, so a crash cannot leave a half-written file.

To restore a backup, stop the bot, replace `data/stats.json`, start it again.
A corrupt file is moved aside automatically as `stats.json.corrupt-<timestamp>`.

## Invite link

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=274877926400
```

Permissions: View Channels, Send Messages, Embed Links, Send Messages in Threads.
Nothing else. No Administrator, no message history, no member intent.
