#!/bin/bash

# Path to the IP ranges file
IP_RANGES_FILE="./k8s/ip_ranges.txt"
GCP_PROJECT_ID="phx-01hnapr4ab4"
NETWORK="default"
FIREWALL_RULE_PREFIX="foresight-poc"
TARGET_TAGS="foresight-poc"
ALLOWED_PORTS="tcp:5005,tcp:5006,tcp:8000,tcp:7474,tcp:7687"
PRIORITY=100

# Function to update or create a firewall rule with a chunk of IP ranges
update_firewall_rule() {
    local rule_name=$1
    local ip_ranges=$2
    # Check if the firewall rule exists
    if gcloud compute firewall-rules describe "$rule_name" --project="$GCP_PROJECT_ID" &> /dev/null; then
        # Update existing firewall rule
        echo "Updating $rule_name..."
        gcloud compute firewall-rules update "$rule_name" \
            --source-ranges="$ip_ranges" \
            --rules="$ALLOWED_PORTS" \
            --project="$GCP_PROJECT_ID"
    else
        # Create a new firewall rule if it doesn't exist
        echo "Creating $rule_name..."
        gcloud compute firewall-rules create "$rule_name" \
            --direction=INGRESS \
            --priority="$PRIORITY" \
            --network="$NETWORK" \
            --action=ALLOW \
            --rules="$ALLOWED_PORTS" \
            --source-ranges="$ip_ranges" \
            --target-tags="$TARGET_TAGS" \
            --project="$GCP_PROJECT_ID"
    fi
}

# Read IP ranges from the file, excluding comments and empty lines
IFS=$'\n' read -d '' -r -a IP_RANGES < <(grep -vE '^#|^$' "$IP_RANGES_FILE" && printf '\0')

# Define the size of each IP range chunk
CHUNK_SIZE=2000  # Adjust based on GCP's sourceRanges limit and testing

# Loop through the IP ranges and process them in chunks
for ((i = 0; i < ${#IP_RANGES[@]}; i += CHUNK_SIZE)); do
    # Extract a chunk of IP ranges
    CHUNK=("${IP_RANGES[@]:i:CHUNK_SIZE}")
    # Convert the chunk array into a comma-separated string
    CHUNK_STRING=$(printf "%s," "${CHUNK[@]}")
    CHUNK_STRING=${CHUNK_STRING%,}  # Remove the trailing comma
    
    # Generate a unique name for each firewall rule based on the chunk index
    FIREWALL_RULE_NAME="${FIREWALL_RULE_PREFIX}-$(printf "%03d" $((i / CHUNK_SIZE + 1)))"
    
    # Update or create the firewall rule with the current chunk of IP ranges
    update_firewall_rule "$FIREWALL_RULE_NAME" "$CHUNK_STRING"
done

echo "All IP ranges have been processed."
