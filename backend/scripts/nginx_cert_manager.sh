#!/bin/bash

# Environment variables for server names
export NEO4J_BACKEND_DOMAIN="neo4j.llm.foresight-serum.phac-aspc.alpha.canada.ca"
export BACKEND_DOMAIN="llm.foresight-serum.phac-aspc.alpha.canada.ca"
export DEV_BACKEND_DOMAIN="dev.llm.foresight-serum.phac-aspc.alpha.canada.ca"
export NEO4J_BOLT_PORT=7687

# Email for Let's Encrypt registration
LETSENCRYPT_EMAIL="simardeep.singh@phac-aspc.gc.ca"

# Check and install Nginx full for stream module support
echo "Checking and installing Nginx with stream module..."
if ! nginx -v &> /dev/null; then
    sudo apt update
    sudo apt install nginx-full -y
else
    echo "Nginx is already installed."
fi

# Check if Certbot is installed
if ! certbot --version &> /dev/null; then
    echo "Certbot not found, installing..."
    sudo apt install certbot python3-certbot-nginx -y
else
    echo "Certbot is already installed."
fi


########################################################
# Ask user for environment type for SSL certificates
# echo "Select environment for SSL certificates:"
# echo "1) Staging"
# echo "2) Prod"
# read -p "Enter your choice (1 or 2): " env_choice

# if [ "$env_choice" = "1" ]; then
#     CERTBOT_SERVER="--server https://acme-staging-v02.api.letsencrypt.org/directory"
#     echo "Staging environment selected."
# elif [ "$env_choice" = "2" ]; then
#     CERTBOT_SERVER=""
#     echo "Production environment selected."
# else
#     echo "Invalid selection. Defaulting to Staging environment."
#     CERTBOT_SERVER="--server https://acme-staging-v02.api.letsencrypt.org/directory"
# fi
########################################################


# Ensure server_names_hash_bucket_size is set in nginx.conf
if ! grep -q "server_names_hash_bucket_size" /etc/nginx/nginx.conf; then
    echo "Adjusting server_names_hash_bucket_size in nginx.conf..."
    sudo sed -i '/http {/a \    server_names_hash_bucket_size 128;' /etc/nginx/nginx.conf
fi

# Function to create or replace Nginx server block
create_or_replace_server_block() {
    local domain=$1
    local port=$2
    local path="/etc/nginx/sites-available/$domain"
    
    # Delete existing server block if it exists
    if [ -L /etc/nginx/sites-enabled/$domain ]; then
        sudo rm /etc/nginx/sites-enabled/$domain
    fi
    
    if [ -f $path ]; then
        sudo rm $path
    fi
    
    cat <<EOF | sudo tee /etc/nginx/sites-available/$domain
server {
    listen 80;
    server_name $domain;

    location / {
        proxy_pass http://localhost:$port;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    sudo ln -s /etc/nginx/sites-available/$domain /etc/nginx/sites-enabled/$domain
}


########################################################
# Ensure the streams configuration is included in nginx.conf
# if ! grep -q "streams-enabled/*" /etc/nginx/nginx.conf; then
#     echo "Including stream configuration in nginx.conf..."
#     sudo sed -i '/http {/i include /etc/nginx/streams-enabled/*;' /etc/nginx/nginx.conf
# fi
########################################################


# Create or replace server blocks and setup Bolt stream
create_or_replace_server_block $NEO4J_BACKEND_DOMAIN 7474
create_or_replace_server_block $BACKEND_DOMAIN 5005
create_or_replace_server_block $DEV_BACKEND_DOMAIN 5006

# Test Nginx configuration and reload
if sudo nginx -t; then
    sudo systemctl reload nginx
else
    echo "Error in Nginx configuration."
    exit 1
fi

########################################################
# Delete existing SSL certificates for the domains if they exist
# for domain in $NEO4J_BACKEND_DOMAIN $BACKEND_DOMAIN $DEV_BACKEND_DOMAIN; do
#     if sudo certbot certificates | grep -q $domain; then
#         echo "Deleting existing certificate for $domain..."
#         sudo certbot delete --cert-name $domain
#     fi
# done
########################################################

# Obtain and configure SSL certificates for all domains with the chosen environment
sudo certbot --nginx -m $LETSENCRYPT_EMAIL --agree-tos -d $NEO4J_BACKEND_DOMAIN -d $BACKEND_DOMAIN -d $DEV_BACKEND_DOMAIN --redirect --non-interactive

# Setup automatic renewal
(crontab -l 2>/dev/null; echo "0 12 * * * certbot renew --post-hook 'systemctl reload nginx'") | crontab -

# Test Nginx configuration and reload
if sudo nginx -t; then
    sudo systemctl reload nginx
else
    echo "Error in Nginx configuration."
    exit 1
fi

echo "Setup complete. Nginx is configured for HTTP, HTTPS, and Neo4j Bolt traffic, with SSL certificates installed and set for auto-renewal."

########################################################
# Stream configuration for Neo4j Bolt directly in nginx.conf
# echo "Adding stream configuration for Neo4j Bolt in nginx.conf..."
# STREAM_CONF="stream {
#     upstream neo4j_bolt {
#         server localhost:$NEO4J_BOLT_PORT;
#     }
#     server {
#         listen 7688 ssl;
#         proxy_pass neo4j_bolt;
#         ssl_certificate /etc/letsencrypt/live/$NEO4J_BACKEND_DOMAIN/fullchain.pem;
#         ssl_certificate_key /etc/letsencrypt/live/$NEO4J_BACKEND_DOMAIN/privkey.pem;
#         ssl_protocols TLSv1.2 TLSv1.3;
#         ssl_ciphers HIGH:!aNULL:!MD5;
#     }
# }"
# echo "$STREAM_CONF" | sudo tee -a /etc/nginx/nginx.conf
# sudo chmod -R 755 /etc/letsencrypt/live/
# sudo chmod -R 755 /etc/letsencrypt/archive/
# sudo nginx -t && sudo systemctl restart nginx
# sudo tail /var/log/nginx/error.log
# sudo tail /var/log/nginx/access.log
# /etc/nginx/streams-enabled/neo4j_bolt.conf
# /etc/nginx/nginx.conf
########################################################