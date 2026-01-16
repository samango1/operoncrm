#!/bin/bash

echo "Running auto-formatters before commit..."

if [ -d "client" ]; then
    echo "Formatting client..."
    cd client
    npx prettier --write . --ignore-unknown
    cd ..
    echo "Client formatting complete!"
else
    echo "Client directory not found"
fi

if [ -d "server" ]; then
    echo "Formatting server..."
    cd server
    black .
    cd ..
    echo "Server formatting complete!"
else
    echo "Server directory not found"
fi

echo "All formatting complete!"
