#!/usr/bin/env python3
"""
Improved Training Script for Better Accuracy

This script addresses overfitting and generalization issues with:
1. Better data augmentation
2. Proper train/validation split
3. Regularization techniques
4. Learning rate scheduling
5. Model architecture improvements
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras.applications.efficientnet import preprocess_input
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout, BatchNormalization
from tensorflow.keras.models import Model
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, LearningRateScheduler
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.regularizers import l2
import matplotlib.pyplot as plt
import json
from pathlib import Path

# Configuration
IMG_SIZE = (224, 224)
BATCH_SIZE = 16  # Smaller batch size for better generalization
EPOCHS = 100
INITIAL_LR = 0.001
MIN_LR = 1e-7

def create_improved_model(num_classes):
    """Create improved model with better regularization"""
    print("Creating improved EfficientNetB0 model...")
    
    # Use EfficientNetB0 instead of MobileNetV2 for better accuracy
    base_model = EfficientNetB0(
        weights='imagenet',
        include_top=False,
        input_shape=(*IMG_SIZE, 3)
    )
    
    # Freeze base model initially
    base_model.trainable = False
    
    # Add improved custom layers
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = BatchNormalization()(x)
    x = Dense(512, activation='relu', kernel_regularizer=l2(0.01))(x)
    x = Dropout(0.5)(x)
    x = BatchNormalization()(x)
    x = Dense(256, activation='relu', kernel_regularizer=l2(0.01), name='feature_dense')(x)
    x = Dropout(0.3)(x)
    predictions = Dense(num_classes, activation='softmax', name='predictions')(x)
    
    model = Model(inputs=base_model.input, outputs=predictions)
    
    # Compile with label smoothing
    model.compile(
        optimizer=Adam(learning_rate=INITIAL_LR),
        loss='categorical_crossentropy',
        metrics=['accuracy', 'top_k_categorical_accuracy']
    )
    
    print(f"Model created with {num_classes} classes")
    return model

def create_improved_data_generators(train_dir):
    """Create data generators with better augmentation"""
    
    # More aggressive augmentation for training
    train_datagen = ImageDataGenerator(
        preprocessing_function=preprocess_input,
        rotation_range=30,
        width_shift_range=0.3,
        height_shift_range=0.3,
        shear_range=0.3,
        zoom_range=0.3,
        horizontal_flip=True,
        vertical_flip=False,
        brightness_range=[0.7, 1.3],
        channel_shift_range=0.2,
        fill_mode='nearest',
        validation_split=0.25  # 75% train, 25% validation
    )
    
    # Minimal augmentation for validation
    val_datagen = ImageDataGenerator(
        preprocessing_function=preprocess_input,
        validation_split=0.25
    )
    
    # Create generators
    train_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=True,
        subset='training',
        seed=42
    )
    
    val_generator = val_datagen.flow_from_directory(
        train_dir,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=False,
        subset='validation',
        seed=42
    )
    
    return train_generator, val_generator

def lr_schedule(epoch):
    """Learning rate schedule"""
    if epoch < 10:
        return INITIAL_LR
    elif epoch < 30:
        return INITIAL_LR * 0.1
    elif epoch < 60:
        return INITIAL_LR * 0.01
    else:
        return INITIAL_LR * 0.001

def plot_training_history(history, save_path='ML/models/improved_training_history.png'):
    """Plot training history"""
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    
    # Accuracy
    axes[0, 0].plot(history.history['accuracy'], label='Train Accuracy')
    axes[0, 0].plot(history.history['val_accuracy'], label='Val Accuracy')
    axes[0, 0].set_title('Model Accuracy')
    axes[0, 0].set_xlabel('Epoch')
    axes[0, 0].set_ylabel('Accuracy')
    axes[0, 0].legend()
    axes[0, 0].grid(True)
    
    # Loss
    axes[0, 1].plot(history.history['loss'], label='Train Loss')
    axes[0, 1].plot(history.history['val_loss'], label='Val Loss')
    axes[0, 1].set_title('Model Loss')
    axes[0, 1].set_xlabel('Epoch')
    axes[0, 1].set_ylabel('Loss')
    axes[0, 1].legend()
    axes[0, 1].grid(True)
    
    # Top-K Accuracy
    axes[1, 0].plot(history.history['top_k_categorical_accuracy'], label='Train Top-K')
    axes[1, 0].plot(history.history['val_top_k_categorical_accuracy'], label='Val Top-K')
    axes[1, 0].set_title('Top-K Accuracy')
    axes[1, 0].set_xlabel('Epoch')
    axes[1, 0].set_ylabel('Accuracy')
    axes[1, 0].legend()
    axes[1, 0].grid(True)
    
    # Learning Rate
    if 'lr' in history.history:
        axes[1, 1].plot(history.history['lr'], label='Learning Rate')
        axes[1, 1].set_title('Learning Rate')
        axes[1, 1].set_xlabel('Epoch')
        axes[1, 1].set_ylabel('LR')
        axes[1, 1].set_yscale('log')
        axes[1, 1].legend()
        axes[1, 1].grid(True)
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"Training history saved to {save_path}")

def train_improved_model(train_dir='ML/dataset'):
    """Main improved training function"""
    
    # Create directories
    os.makedirs('ML/models', exist_ok=True)
    
    # Check if data directory exists
    if not os.path.exists(train_dir):
        print(f"Error: Training directory '{train_dir}' not found!")
        return
    
    print("="*60)
    print("🚗 IMPROVED AUTOMOBILE PARTS CLASSIFIER TRAINING")
    print("="*60)
    
    # Create data generators
    print("\n📂 Loading data with improved augmentation...")
    train_generator, val_generator = create_improved_data_generators(train_dir)
    
    num_classes = len(train_generator.class_indices)
    print(f"✅ Found {num_classes} classes")
    print(f"✅ Training samples: {train_generator.samples}")
    print(f"✅ Validation samples: {val_generator.samples}")
    
    # Create model
    print("\n🤖 Creating improved model...")
    model = create_improved_model(num_classes)
    
    # Callbacks
    callbacks = [
        ModelCheckpoint(
            'ML/models/improved_parts_classifier_best.h5',
            monitor='val_accuracy',
            save_best_only=True,
            mode='max',
            verbose=1,
            save_weights_only=False
        ),
        EarlyStopping(
            monitor='val_loss',
            patience=15,
            restore_best_weights=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=8,
            min_lr=MIN_LR,
            verbose=1
        ),
        LearningRateScheduler(lr_schedule, verbose=1)
    ]
    
    # Phase 1: Train with frozen base model
    print("\n🏋️ Phase 1: Training with frozen base model...")
    print(f"Epochs: {min(20, EPOCHS)}")
    print(f"Batch size: {BATCH_SIZE}")
    print(f"Initial learning rate: {INITIAL_LR}")
    print("="*60 + "\n")
    
    history1 = model.fit(
        train_generator,
        epochs=min(20, EPOCHS),
        validation_data=val_generator,
        callbacks=callbacks,
        verbose=1
    )
    
    # Phase 2: Fine-tune with unfrozen layers
    if EPOCHS > 20:
        print("\n🔧 Phase 2: Fine-tuning with unfrozen layers...")
        
        # Find the base model layer (EfficientNet)
        base_model = None
        for layer in model.layers:
            if hasattr(layer, 'layers') and len(layer.layers) > 50:  # EfficientNet has many layers
                base_model = layer
                break
        
        if base_model:
            base_model.trainable = True
            
            # Freeze early layers, unfreeze last 20
            for layer in base_model.layers[:-20]:
                layer.trainable = False
        
        # Recompile with lower learning rate
        model.compile(
            optimizer=Adam(learning_rate=INITIAL_LR/10),
            loss='categorical_crossentropy',
            metrics=['accuracy', 'top_k_categorical_accuracy']
        )
        
        # Continue training
        history2 = model.fit(
            train_generator,
            epochs=EPOCHS - 20,
            initial_epoch=20,
            validation_data=val_generator,
            callbacks=callbacks,
            verbose=1
        )
        
        # Combine histories
        for key in history1.history:
            if key in history2.history:
                history1.history[key].extend(history2.history[key])
    
    # Save final model
    model.save('ML/models/improved_parts_classifier.h5')
    print("\n✅ Model saved to ML/models/improved_parts_classifier.h5")
    
    # Plot history
    plot_training_history(history1)
    
    # Evaluate
    print("\n📊 Final Evaluation:")
    val_loss, val_acc, val_top_k = model.evaluate(val_generator, verbose=0)
    print(f"Validation Loss: {val_loss:.4f}")
    print(f"Validation Accuracy: {val_acc:.4f}")
    print(f"Top-3 Accuracy: {val_top_k:.4f}")
    
    # Save class indices
    with open('ML/models/improved_class_indices.json', 'w') as f:
        json.dump(train_generator.class_indices, f, indent=2)
    print("✅ Class indices saved to ML/models/improved_class_indices.json")
    
    # Save training summary
    summary = {
        'num_classes': num_classes,
        'training_samples': train_generator.samples,
        'validation_samples': val_generator.samples,
        'final_val_accuracy': float(val_acc),
        'final_val_loss': float(val_loss),
        'final_top_k_accuracy': float(val_top_k),
        'epochs_trained': len(history1.history['loss']),
        'batch_size': BATCH_SIZE,
        'image_size': IMG_SIZE
    }
    
    with open('ML/models/training_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    print("\n" + "="*60)
    print("🎉 IMPROVED TRAINING COMPLETE!")
    print(f"📈 Final Validation Accuracy: {val_acc:.1%}")
    print(f"📈 Top-3 Accuracy: {val_top_k:.1%}")
    print("="*60)
    
    return model, history1

if __name__ == "__main__":
    # Set memory growth for GPU if available
    gpus = tf.config.experimental.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
        except RuntimeError as e:
            print(e)
    
    # Train the improved model
    model, history = train_improved_model()