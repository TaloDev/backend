FROM clickhouse/clickhouse-server:24.10-alpine

RUN apk add --no-cache gettext

COPY /clickhouse/migrations /docker-entrypoint-initdb.d/
COPY /clickhouse/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
