#!/usr/bin/env python3
"""
Improved Final Training Script

This addresses the issues found in testing:
1. Better data augmentation
2. Improved model architecture
3. Better training parameters
4. Class balancing
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout, BatchNormalization
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.regularizers import l2
import json
import matplotlib.pyplot as plt
from sklearn.utils.class_weight import compute_class_weight
from pathlib import Path

class ImprovedPartsClassifier:
    def __init__(self, dataset_path='ML/clean_dataset/split'):
        self.dataset_path = dataset_path
        self.img_size = (224, 224)
        self.batch_size = 32
        self.model = None
        self.history = None
        
        # Create output directory
        os.makedirs('ML/models', exist_ok=True)
    
    def create_improved_data_generators(self):
        """Create improved data generators with better augmentation"""
        print("🔄 Creating improved data generators...")
        
        # More aggressive augmentation for training
        train_datagen = ImageDataGenerator(
            rescale=1./255,
            rotation_range=30,
            width_shift_range=0.3,
            height_shift_range=0.3,
            shear_range=0.3,
            zoom_range=0.3,
            horizontal_flip=True,
            vertical_flip=True,
            brightness_range=[0.7, 1.3],
            channel_shift_range=0.2,
            fill_mode='nearest'
        )
        
        # Only rescaling for validation
        val_datagen = ImageDataGenerator(rescale=1./255)
        
        # Load training data
        train_generator = train_datagen.flow_from_directory(
            os.path.join(self.dataset_path, 'train'),
            target_size=self.img_size,
            batch_size=self.batch_size,
            class_mode='categorical',
            shuffle=True,
            seed=42
        )
        
        # Load validation data
        val_generator = val_datagen.flow_from_directory(
            os.path.join(self.dataset_path, 'validation'),
            target_size=self.img_size,
            batch_size=self.batch_size,
            class_mode='categorical',
            shuffle=False,
            seed=42
        )
        
        print(f"✅ Training samples: {train_generator.samples}")
        print(f"✅ Validation samples: {val_generator.samples}")
        print(f"✅ Number of classes: {train_generator.num_classes}")
        
        return train_generator, val_generator
    
    def calculate_class_weights(self, train_generator):
        """Calculate class weights to handle any remaining imbalance"""
        print("⚖️ Calculating class weights...")
        
        # Get class labels
        labels = train_generator.classes
        class_labels = np.unique(labels)
        
        # Calculate class weights
        class_weights = compute_class_weight(
            'balanced',
            classes=class_labels,
            y=labels
        )
        
        # Ensure we have weights for all classes (0 to num_classes-1)
        class_weight_dict = {}
        for i in range(train_generator.num_classes):
            if i in class_labels:
                idx = np.where(class_labels == i)[0][0]
                class_weight_dict[i] = class_weights[idx]
            else:
                class_weight_dict[i] = 1.0  # Default weight for missing classes
        
        print("Class weights:")
        for class_idx, weight in class_weight_dict.items():
            if class_idx < len(train_generator.class_indices):
                class_name = list(train_generator.class_indices.keys())[class_idx]
                print(f"  {class_name}: {weight:.2f}")
        
        return class_weight_dict
    
    def create_improved_model(self, num_classes):
        """Create an improved model architecture"""
        print("🏗️ Creating improved model architecture...")
        
        # Load pre-trained EfficientNetB0
        base_model = EfficientNetB0(
            weights='imagenet',
            include_top=False,
            input_shape=(*self.img_size, 3)
        )
        
        # Unfreeze more layers for better fine-tuning
        for layer in base_model.layers[-50:]:  # Unfreeze last 50 layers
            layer.trainable = True
        
        # Add improved classification head
        x = base_model.output
        x = GlobalAveragePooling2D()(x)
        
        # Add more sophisticated head
        x = Dense(512, activation='relu', kernel_regularizer=l2(0.01))(x)
        x = BatchNormalization()(x)
        x = Dropout(0.5)(x)
        
        x = Dense(256, activation='relu', kernel_regularizer=l2(0.01))(x)
        x = BatchNormalization()(x)
        x = Dropout(0.3)(x)
        
        # Output layer
        predictions = Dense(num_classes, activation='softmax', name='predictions')(x)
        
        model = Model(inputs=base_model.input, outputs=predictions)
        
        # Use a lower learning rate for fine-tuning
        optimizer = Adam(learning_rate=0.0001)
        
        model.compile(
            optimizer=optimizer,
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        
        print(f"✅ Model created with {num_classes} classes")
        return model
    
    def setup_callbacks(self):
        """Setup improved training callbacks"""
        callbacks = [
            ModelCheckpoint(
                'ML/models/improved_final_parts_classifier_best.h5',
                monitor='val_accuracy',
                save_best_only=True,
                mode='max',
                verbose=1
            ),
            EarlyStopping(
                monitor='val_accuracy',
                patience=15,  # More patience
                restore_best_weights=True,
                verbose=1
            ),
            ReduceLROnPlateau(
                monitor='val_accuracy',
                factor=0.5,
                patience=7,
                min_lr=1e-7,
                verbose=1
            )
        ]
        return callbacks
    
    def train_model(self, epochs=50):
        """Train the improved model"""
        print("🚀 Starting improved training...")
        
        # Create data generators
        train_gen, val_gen = self.create_improved_data_generators()
        
        # Calculate class weights
        class_weights = self.calculate_class_weights(train_gen)
        
        # Create model
        self.model = self.create_improved_model(train_gen.num_classes)
        
        # Setup callbacks
        callbacks = self.setup_callbacks()
        
        # Save class indices
        class_indices_path = 'ML/models/improved_final_class_indices.json'
        with open(class_indices_path, 'w') as f:
            json.dump(train_gen.class_indices, f, indent=2)
        print(f"✅ Class indices saved to {class_indices_path}")
        
        # Train model
        print(f"🎯 Training for {epochs} epochs...")
        self.history = self.model.fit(
            train_gen,
            epochs=epochs,
            validation_data=val_gen,
            callbacks=callbacks,
            class_weight=class_weights,
            verbose=1
        )
        
        # Save final model
        final_model_path = 'ML/models/improved_final_parts_classifier.h5'
        self.model.save(final_model_path)
        print(f"✅ Final model saved to {final_model_path}")
        
        return self.history
    
    def plot_training_history(self):
        """Plot training history"""
        if not self.history:
            return
        
        plt.figure(figsize=(12, 4))
        
        # Plot accuracy
        plt.subplot(1, 2, 1)
        plt.plot(self.history.history['accuracy'], label='Training Accuracy')
        plt.plot(self.history.history['val_accuracy'], label='Validation Accuracy')
        plt.title('Model Accuracy')
        plt.xlabel('Epoch')
        plt.ylabel('Accuracy')
        plt.legend()
        
        # Plot loss
        plt.subplot(1, 2, 2)
        plt.plot(self.history.history['loss'], label='Training Loss')
        plt.plot(self.history.history['val_loss'], label='Validation Loss')
        plt.title('Model Loss')
        plt.xlabel('Epoch')
        plt.ylabel('Loss')
        plt.legend()
        
        plt.tight_layout()
        plt.savefig('ML/models/improved_training_history.png', dpi=300, bbox_inches='tight')
        plt.show()
        
        print("✅ Training history plot saved")
    
    def evaluate_model(self):
        """Evaluate the trained model"""
        if not self.model:
            print("❌ No model to evaluate")
            return
        
        print("📊 Evaluating model...")
        
        # Load validation data
        val_datagen = ImageDataGenerator(rescale=1./255)
        val_generator = val_datagen.flow_from_directory(
            os.path.join(self.dataset_path, 'validation'),
            target_size=self.img_size,
            batch_size=self.batch_size,
            class_mode='categorical',
            shuffle=False
        )
        
        # Evaluate
        val_loss, val_accuracy = self.model.evaluate(val_generator, verbose=1)
        
        print(f"📈 Final Validation Accuracy: {val_accuracy:.4f}")
        print(f"📉 Final Validation Loss: {val_loss:.4f}")
        
        return val_accuracy, val_loss

def main():
    """Main training function"""
    print("="*60)
    print("🚀 IMPROVED PARTS VISION TRAINING")
    print("="*60)
    
    # Check if split dataset exists
    split_path = 'ML/clean_dataset/split'
    if not os.path.exists(split_path):
        print("❌ Split dataset not found. Please run data preparation first.")
        return
    
    # Initialize trainer
    trainer = ImprovedPartsClassifier()
    
    # Train model
    history = trainer.train_model(epochs=50)
    
    # Plot results
    trainer.plot_training_history()
    
    # Evaluate
    val_acc, val_loss = trainer.evaluate_model()
    
    print("\n" + "="*60)
    print("🎉 IMPROVED TRAINING COMPLETE!")
    print(f"📈 Final Accuracy: {val_acc:.1%}")
    print("✅ Model saved to ML/models/improved_final_parts_classifier_best.h5")
    print("="*60)

if __name__ == "__main__":
    main()