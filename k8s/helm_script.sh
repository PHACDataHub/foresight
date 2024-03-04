#!/bin/bash

# Function to perform Helm install
function helm_install() {
    echo "Performing Helm install..."
    helm install foresight k8s/ -f k8s/values.yaml -n=foresight
}

# Function to perform Helm upgrade
function helm_upgrade() {
    echo "Performing Helm upgrade..."
    helm upgrade foresight k8s/ -f k8s/values.yaml -n=foresight
}

# Function to perform Helm uninstall
function helm_uninstall() {
    echo "Performing Helm uninstall..."
    helm uninstall foresight -n=foresight
}

# Main menu function
function main_menu() {
    echo "Please choose an action:"
    echo "1) Install"
    echo "2) Upgrade"
    echo "3) Uninstall"
    echo "4) Exit"
    read -p "Enter your choice [1-4]: " choice

    case $choice in
        1) helm_install ;;
        2) helm_upgrade ;;
        3) helm_uninstall ;;
        4) echo "Exiting..." ; exit 0 ;;
        *) echo "Invalid choice, please choose again." ; main_menu ;;
    esac
}

# Run the main menu function
main_menu
