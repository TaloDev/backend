FROM clickhouse/clickhouse-server:24.11-alpine

RUN apk add --no-cache gettext

COPY /clickhouse/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
