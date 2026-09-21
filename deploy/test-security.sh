#!/bin/bash
echo "--- 12x zly kod z IP 10.9.9.9 ---"
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -H "Content-Type: application/json" -H "X-Real-IP: 10.9.9.9" \
    --data '{"name":"x","code":"ZZZZ"}' \
    http://127.0.0.1:8502/api/join)
  echo -n "$code "
done
echo
echo "--- poprawny host z lokalnego IP (powinno byc 200) ---"
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 \
  -H "Content-Type: application/json" \
  --data '{"name":"ok"}' \
  http://127.0.0.1:8502/api/host
