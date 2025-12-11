#!/bin/bash

# Source and destination directories
SOURCE_DIR="../cogact"
DEST_DIR="./videos/cogact"

# Check if source and destination directories are provided
if [[ -z "$SOURCE_DIR" || -z "$DEST_DIR" ]]; then
    echo "Usage: $0 <source_directory> <destination_directory>"
    exit 1
fi

# Check if source directory exists
if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "Source directory does not exist."
    exit 1
fi

# Create destination directory if it doesn't exist
if [[ ! -d "$DEST_DIR" ]]; then
    echo "Destination directory does not exist. Creating it..."
    mkdir -p "$DEST_DIR"
fi

# Find and move video files from source to destination
find "$SOURCE_DIR" -type f \( -iname "*.mp4" -o -iname "*.avi" -o -iname "*.mov" \) -exec mv {} "$DEST_DIR" \;

# Now, rename the moved files to remove all '.' except the last one (extension part)
cd "$DEST_DIR"
for file in *.*; do
    # Extract the file name and extension
    base_name=$(basename "$file" .${file##*.})  # Get the name without extension
    extension="${file##*.}"  # Extract the extension
    
    # Remove all '.' from the base name
    new_base_name=$(echo "$base_name" | tr -d '.')
    
    # Concatenate the new base name with the original extension
    new_name="${new_base_name}.${extension}"
    
    # Rename the file
    mv "$file" "$new_name"
done

echo "All video files have been moved and renamed in $DEST_DIR."
