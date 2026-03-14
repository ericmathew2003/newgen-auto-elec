import React, { useState, useRef } from 'react';
import { Camera, Upload, Search, Eye, Zap, CheckCircle, AlertCircle, Package, DollarSign, Car, X } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const PartIdentification = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Handle file selection
  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    } else {
      setError('Please select a valid image file');
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }
      });
      videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch (err) {
      setError('Camera access denied or not available');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
      handleFileSelect(file);
      stopCamera();
    }, 'image/jpeg', 0.8);
  };

  // Identify part
  const identifyPart = async () => {
    if (!selectedFile) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/parts/identify`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      });

      setResult(response.data);
    } catch (error) {
      console.error('Error identifying part:', error);
      
      // Handle filtered rejection (non-automotive image)
      if (error.response?.status === 400 && error.response?.data?.filtered) {
        const errorData = error.response.data;
        setError(
          <div className="space-y-2">
            <p className="font-semibold text-red-700">❌ {errorData.message}</p>
            <p className="text-sm text-red-600">
              Detected: <span className="font-mono">{errorData.detected_object}</span>
            </p>
            <p className="text-sm text-gray-600">{errorData.suggestion}</p>
          </div>
        );
      } else {
        setError(error.response?.data?.error || 'Failed to identify part. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStockStatusColor = (status) => {
    switch (status) {
      case 'In Stock': return 'bg-green-100 text-green-800';
      case 'Low Stock': return 'bg-yellow-100 text-yellow-800';
      case 'Out of Stock': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center">
            <Search className="w-10 h-10 mr-3 text-blue-600" />
            AI Part Identification System
          </h1>
          <p className="text-xl text-gray-600">
            Upload an image of any automobile spare part to identify it instantly
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Upload Section */}
          <div className="space-y-6">
            {/* Upload Area */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <Upload className="w-6 h-6 mr-2 text-blue-600" />
                Upload Part Image
              </h2>
              
              {/* Drag and Drop Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                
                {preview ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <img 
                        src={preview} 
                        alt="Preview" 
                        className="max-w-full max-h-64 mx-auto rounded-lg shadow-md" 
                      />
                      <button
                        onClick={() => {
                          setPreview(null);
                          setSelectedFile(null);
                          setResult(null);
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex space-x-3 justify-center">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Change Image
                      </button>
                      <button
                        onClick={identifyPart}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Identifying...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Identify Part
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="w-16 h-16 mx-auto text-gray-400" />
                    <div>
                      <p className="text-lg text-gray-600 mb-2">Drop your image here, or click to browse</p>
                      <p className="text-sm text-gray-400">Supports JPG, PNG, WebP up to 10MB</p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Choose File
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Camera Section - Temporarily Hidden */}
            {false && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <Camera className="w-6 h-6 mr-2 text-green-600" />
                Use Camera
              </h2>
              
              {!cameraActive ? (
                <button
                  onClick={startCamera}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Start Camera
                </button>
              ) : (
                <div className="space-y-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg"
                  />
                  <div className="flex space-x-3">
                    <button
                      onClick={capturePhoto}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Capture Photo
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              <canvas ref={canvasRef} className="hidden" />
            </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="text-red-700">
                  {typeof error === 'string' ? error : error}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Results Section */}
          <div className="space-y-6">
            {result ? (
              <>
                {/* Identification Results */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-semibold mb-4 flex items-center">
                    <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                    Identification Results
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Category</p>
                      <p className="text-lg font-semibold">{result.identification.category_display}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Confidence</p>
                      <p className={`text-lg font-semibold ${getConfidenceColor(result.identification.confidence)}`}>
                        {(result.identification.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="col-span-2 bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Group</p>
                      <p className="text-xl font-bold text-blue-900">
                        {result.identification.group_name}
                      </p>
                    </div>
                  </div>

                  {/* Statistics */}
                  {result.statistics && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-gray-600">Total Parts</p>
                        <p className="text-lg font-bold text-green-700">{result.statistics.total_parts}</p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded">
                        <p className="text-gray-600">In Stock</p>
                        <p className="text-lg font-bold text-blue-700">{result.statistics.in_stock}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Exact Match */}
                {result.exact_match && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                    <h3 className="text-xl font-semibold mb-3 text-green-800 flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Exact Match Found!
                    </h3>
                    <div className="space-y-2">
                      <p className="text-lg font-bold">{result.exact_match.itemname}</p>
                      <p className="text-gray-700">Part No: <span className="font-mono font-bold">{result.exact_match.partno}</span></p>
                      {result.exact_match.car_make && (
                        <p className="text-gray-700">Car: {result.exact_match.car_make} {result.exact_match.model}</p>
                      )}
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-2xl font-bold text-green-600">
                          {formatCurrency(result.exact_match.sprice)}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStockStatusColor(result.exact_match.stock > 10 ? 'In Stock' : result.exact_match.stock > 0 ? 'Low Stock' : 'Out of Stock')}`}>
                          Stock: {result.exact_match.curstock}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Compatible Car Makes */}
                {result.compatible_makes && result.compatible_makes.length > 0 && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center">
                      <Car className="w-5 h-5 mr-2 text-blue-600" />
                      Compatible Car Makes ({result.compatible_makes.length})
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {result.compatible_makes.map((make, index) => (
                        <div key={index} className="bg-blue-50 p-3 rounded-lg">
                          <p className="font-semibold text-blue-900">{make.makename}</p>
                          <p className="text-sm text-blue-700">{make.parts_available} parts available</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parts in Category */}
                {result.parts_in_category && result.parts_in_category.length > 0 && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center">
                      <Package className="w-5 h-5 mr-2 text-purple-600" />
                      Available Parts ({result.parts_in_category.length})
                    </h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {result.parts_in_category.slice(0, 10).map((part, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{part.itemname}</p>
                              {part.partno && (
                                <p className="text-sm text-gray-600 font-mono">{part.partno}</p>
                              )}
                              {part.car_make && (
                                <p className="text-sm text-blue-600">{part.car_make} {part.model}</p>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStockStatusColor(part.stock_status)}`}>
                              {part.stock_status}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(part.price)}
                            </span>
                            <span className="text-sm text-gray-500">
                              Stock: {part.stock} {part.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <Eye className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-xl text-gray-500">Upload an image to see results</p>
                <p className="text-sm text-gray-400 mt-2">
                  The system will identify the part and show compatible vehicles
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartIdentification;
