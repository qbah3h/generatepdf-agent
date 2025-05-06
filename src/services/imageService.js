const Image = require('../models/image');
const path = require('path');
const fs = require('fs');

/**
 * Save image metadata to database
 */
async function saveImage(fileData, from) {
  try {
    const image = new Image({
      from,
      filename: fileData.filename,
      originalName: fileData.originalname,
      mimetype: fileData.mimetype,
      size: fileData.size,
      path: fileData.path
    });
    
    await image.save();
    return image;
  } catch (error) {
    console.error('Error saving image metadata:', error);
    throw error;
  }
}

/**
 * Get image by ID - returns metadata and binary data
 */
async function getImageById(from) {
  try {
    const image = await Image.findOne({ from });
    if (!image) {
      throw new Error('Image not found');
    }
    
    // Read the file data
    const fileData = fs.readFileSync(image.path);
    
    return {
      metadata: image,
      data: fileData
    };
  } catch (error) {
    console.error('Error retrieving image:', error);
    throw error;
  }
}

/**
 * Get image path by ID - for internal use only
 */
async function getImagePathById(from) {
  try {
    const image = await Image.findOne({ from });
    if (!image) {
      throw new Error('Image not found');
    }
    return image.path;
  } catch (error) {
    console.error('Error retrieving image path:', error);
    throw error;
  }
}

/**
 * Delete image by ID
 */
async function deleteImage(from) {
  try {
    const image = await Image.findOne({ from });
    if (!image) {
      throw new Error('Image not found');
    }
    
    // Delete file from filesystem
    fs.unlinkSync(image.path);
    
    // Delete metadata from database
    await Image.findOneAndDelete({ from });
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

module.exports = {
  saveImage,
  getImageById,
  getImagePathById,
  deleteImage
};