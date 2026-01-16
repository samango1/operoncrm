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
    echo "Formatting server with Black..."
    cd server

    if command -v black &> /dev/null; then
        black .
        echo "Server formatting complete!"
    else
        echo "Black not found. Installing black..."
        pip install black
        black .
        echo "Server formatting complete!"
    fi

    cd ..
else
    echo "Server directory not found"
fi

echo "=========================================="
echo "All formatting complete!"
