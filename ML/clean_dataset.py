#!/usr/bin/env python3
"""
Dataset Cleaning and Validation Script

This script:
1. Removes corrupted/invalid images
2. Standardizes image formats
3. Removes duplicates
4. Balances dataset
5. Creates proper train/validation splits
"""

import os
import shutil
import hashlib
from PIL import Image
import numpy as np
from pathlib import Path
import json

def is_valid_image(image_path):
    """Check if image is valid and can be opened"""
    try:
        with Image.open(image_path) as img:
            img.verify()  # Verify image integrity
        
        # Try to load and convert
        with Image.open(image_path) as img:
            img = img.convert('RGB')
            # Check minimum size
            if img.size[0] < 50 or img.size[1] < 50:
                return False
        return True
    except Exception as e:
        print(f"Invalid image {image_path}: {e}")
        return False

def get_image_hash(image_path):
    """Get hash of image for duplicate detection"""
    try:
        with Image.open(image_path) as img:
            img = img.convert('RGB')
            img = img.resize((64, 64))  # Small size for hash
            img_array = np.array(img)
            return hashlib.md5(img_array.tobytes()).hexdigest()
    except:
        return None

def clean_category_folder(category_path, max_images=120):
    """Clean a single category folder"""
    category_name = os.path.basename(category_path)
    print(f"\n🧹 Cleaning {category_name}...")
    
    # Get all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'}
    image_files = []
    
    for file_path in Path(category_path).iterdir():
        if file_path.suffix.lower() in image_extensions:
            image_files.append(file_path)
    
    print(f"  Found {len(image_files)} image files")
    
    # Remove invalid images
    valid_images = []
    removed_count = 0
    
    for img_path in image_files:
        if is_valid_image(img_path):
            valid_images.append(img_path)
        else:
            print(f"  Removing invalid: {img_path.name}")
            img_path.unlink()
            removed_count += 1
    
    print(f"  Removed {removed_count} invalid images")
    print(f"  Valid images: {len(valid_images)}")
    
    # Remove duplicates
    unique_images = []
    seen_hashes = set()
    duplicate_count = 0
    
    for img_path in valid_images:
        img_hash = get_image_hash(img_path)
        if img_hash and img_hash not in seen_hashes:
            seen_hashes.add(img_hash)
            unique_images.append(img_path)
        else:
            print(f"  Removing duplicate: {img_path.name}")
            img_path.unlink()
            duplicate_count += 1
    
    print(f"  Removed {duplicate_count} duplicate images")
    print(f"  Unique images: {len(unique_images)}")
    
    # Limit to max_images if needed
    if len(unique_images) > max_images:
        # Keep the first max_images (you could randomize this)
        for img_path in unique_images[max_images:]:
            print(f"  Removing excess: {img_path.name}")
            img_path.unlink()
        unique_images = unique_images[:max_images]
        print(f"  Limited to {max_images} images")
    
    return len(unique_images)

def standardize_images(category_path, target_size=(224, 224)):
    """Standardize all images in a category to same format and size"""
    category_name = os.path.basename(category_path)
    print(f"\n🔧 Standardizing {category_name}...")
    
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'}
    processed_count = 0
    
    for file_path in Path(category_path).iterdir():
        if file_path.suffix.lower() in image_extensions:
            try:
                with Image.open(file_path) as img:
                    # Convert to RGB
                    img = img.convert('RGB')
                    
                    # Resize maintaining aspect ratio
                    img.thumbnail(target_size, Image.Resampling.LANCZOS)
                    
                    # Create new image with target size and paste centered
                    new_img = Image.new('RGB', target_size, (255, 255, 255))
                    paste_x = (target_size[0] - img.size[0]) // 2
                    paste_y = (target_size[1] - img.size[1]) // 2
                    new_img.paste(img, (paste_x, paste_y))
                    
                    # Save as JPG with standard name
                    new_name = f"{category_name}_{processed_count:03d}.jpg"
                    new_path = file_path.parent / new_name
                    
                    # Remove old file if different name
                    if new_path != file_path:
                        file_path.unlink()
                    
                    new_img.save(new_path, 'JPEG', quality=95)
                    processed_count += 1
                    
            except Exception as e:
                print(f"  Error processing {file_path.name}: {e}")
                file_path.unlink()
    
    print(f"  Standardized {processed_count} images")
    return processed_count

def create_balanced_split(dataset_path, output_path, train_ratio=0.8):
    """Create balanced train/validation split"""
    print(f"\n📊 Creating balanced train/validation split...")
    
    # Create output directories
    train_path = Path(output_path) / 'train'
    val_path = Path(output_path) / 'validation'
    
    train_path.mkdir(parents=True, exist_ok=True)
    val_path.mkdir(parents=True, exist_ok=True)
    
    category_stats = {}
    
    # Process each category
    for category_dir in Path(dataset_path).iterdir():
        if category_dir.is_dir() and not category_dir.name.startswith('.'):
            category_name = category_dir.name
            
            # Skip existing train/validation folders
            if category_name in ['train', 'validation']:
                continue
            
            print(f"  Processing {category_name}...")
            
            # Get all images
            image_files = []
            for img_file in category_dir.iterdir():
                if img_file.suffix.lower() in {'.jpg', '.jpeg', '.png'}:
                    image_files.append(img_file)
            
            # Calculate split
            total_images = len(image_files)
            train_count = int(total_images * train_ratio)
            
            # Create category directories
            train_cat_dir = train_path / category_name
            val_cat_dir = val_path / category_name
            train_cat_dir.mkdir(exist_ok=True)
            val_cat_dir.mkdir(exist_ok=True)
            
            # Copy files
            for i, img_file in enumerate(image_files):
                if i < train_count:
                    shutil.copy2(img_file, train_cat_dir / img_file.name)
                else:
                    shutil.copy2(img_file, val_cat_dir / img_file.name)
            
            category_stats[category_name] = {
                'total': total_images,
                'train': train_count,
                'validation': total_images - train_count
            }
            
            print(f"    Total: {total_images}, Train: {train_count}, Val: {total_images - train_count}")
    
    # Save statistics
    with open(Path(output_path) / 'split_statistics.json', 'w') as f:
        json.dump(category_stats, f, indent=2)
    
    return category_stats

def clean_dataset(dataset_path='ML/dataset', output_path='ML/clean_dataset'):
    """Main dataset cleaning function"""
    print("="*60)
    print("🧹 DATASET CLEANING AND PREPARATION")
    print("="*60)
    
    dataset_path = Path(dataset_path)
    output_path = Path(output_path)
    
    if not dataset_path.exists():
        print(f"Error: Dataset path {dataset_path} does not exist!")
        return
    
    # Create output directory
    output_path.mkdir(exist_ok=True)
    
    # Copy dataset to output location for cleaning
    if output_path != dataset_path:
        print(f"\n📁 Copying dataset to {output_path}...")
        if output_path.exists():
            shutil.rmtree(output_path)
        shutil.copytree(dataset_path, output_path)
    
    category_stats = {}
    
    # Process each category
    for category_dir in output_path.iterdir():
        if category_dir.is_dir() and not category_dir.name.startswith('.'):
            # Skip train/validation folders if they exist
            if category_dir.name in ['train', 'validation']:
                continue
                
            # Clean category
            final_count = clean_category_folder(category_dir)
            
            # Standardize images
            standardized_count = standardize_images(category_dir)
            
            category_stats[category_dir.name] = {
                'final_count': final_count,
                'standardized_count': standardized_count
            }
    
    # Create balanced split
    split_stats = create_balanced_split(output_path, output_path / 'split')
    
    # Generate summary
    total_images = sum(stats['final_count'] for stats in category_stats.values())
    total_categories = len(category_stats)
    
    print("\n" + "="*60)
    print("📊 CLEANING SUMMARY")
    print("="*60)
    print(f"Total categories: {total_categories}")
    print(f"Total images after cleaning: {total_images}")
    print(f"Average images per category: {total_images/total_categories:.1f}")
    print("\nCategory breakdown:")
    
    for category, stats in sorted(category_stats.items()):
        print(f"  {category}: {stats['final_count']} images")
    
    print(f"\n✅ Clean dataset saved to: {output_path}")
    print(f"✅ Train/validation split saved to: {output_path / 'split'}")
    print("="*60)
    
    return category_stats

if __name__ == "__main__":
    clean_dataset()