# media-video-maker

Сервис собирает видео из фото и/или видео. Без Pexels. Есть REST и MCP.

## Запуск
```bash
docker build -t media-video-maker .
docker run -it --rm   -e LOG_LEVEL=debug -e PORT=4123   -p 4123:4123   -v /root/video_factory/assets:/app/data:ro   -v /root/video_factory/videos:/app/output   media-video-maker
```
