# Tube web client

A video-first web client for a Jellyfin-compatible media server: a YouTube-style home, watch page and
player, plus the server dashboard, sign-in and setup wizard, all in one React app. Music, books, photos
and live TV are not part of it.

This is a separate project based on a fork of the Jellyfin web client. It is not affiliated with or
supported by the Jellyfin project, so report problems here rather than upstream. It pairs with the
server fork at https://github.com/0xlek/jellyfin.

## Run

```
docker run -p 8080:8080 ghcr.io/0xlek/jellyfin-web:latest
```

Open http://localhost:8080/web/ and add your server.

## Develop

```
pnpm install
pnpm serve          # dev server
pnpm build:production
pnpm lint && pnpm test
```

## License

GPL-2.0-or-later, see [LICENSE](LICENSE). Earlier contributors to the Jellyfin web client are listed in
[CONTRIBUTORS.md](CONTRIBUTORS.md).
