import React, { useState } from 'react';
import { Wrench, AlertTriangle, Package, Car, CheckCircle, Clock } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const FaultDiagnosis = () => {
  const [symptoms, setSymptoms] = useState(['']);
  const [vehicleInfo, setVehicleInfo] = useState({
    make: '',
    model: '',
    mileage: ''
  });
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addSymptom = () => {
    setSymptoms([...symptoms, '']);
  };

  const updateSymptom = (index, value) => {
    const newSymptoms = [...symptoms];
    newSymptoms[index] = value;
    setSymptoms(newSymptoms);
  };

  const removeSymptom = (index) => {
    if (symptoms.length > 1) {
      setSymptoms(symptoms.filter((_, i) => i !== index));
    }
  };

  const diagnoseFault = async () => {
    const validSymptoms = symptoms.filter(s => s.trim());
    
    if (validSymptoms.length === 0) {
      setError('Please enter at least one symptom');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/fault-diagnosis/diagnose`, {
        symptoms: validSymptoms,
        vehicle_make: vehicleInfo.make,
        vehicle_model: vehicleInfo.model,
        mileage: vehicleInfo.mileage ? parseInt(vehicleInfo.mileage) : null
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setDiagnosis(response.data);
    } catch (error) {
      console.error('Error diagnosing fault:', error);
      setError(error.response?.data?.detail || 'Failed to diagnose fault');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center">
            <Wrench className="w-10 h-10 mr-3 text-blue-600" />
            AI Fault Diagnosis System
          </h1>
          <p className="text-xl text-gray-600">
            Describe your vehicle symptoms and get AI-powered fault diagnosis with spare parts recommendations
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Input Section */}
          <div className="space-y-6">
            {/* Vehicle Information */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <Car className="w-6 h-6 mr-2 text-blue-600" />
                Vehicle Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Make
                  </label>
                  <input
                    type="text"
                    value={vehicleInfo.make}
                    onChange={(e) => setVehicleInfo({...vehicleInfo, make: e.target.value})}
                    placeholder="e.g., Maruti, Toyota, Hyundai"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Model
                  </label>
                  <input
                    type="text"
                    value={vehicleInfo.model}
                    onChange={(e) => setVehicleInfo({...vehicleInfo, model: e.target.value})}
                    placeholder="e.g., Swift, Innova, i20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mileage (km)
                  </label>
                  <input
                    type="number"
                    value={vehicleInfo.mileage}
                    onChange={(e) => setVehicleInfo({...vehicleInfo, mileage: e.target.value})}
                    placeholder="e.g., 50000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Symptoms Input */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <AlertTriangle className="w-6 h-6 mr-2 text-orange-600" />
                Vehicle Symptoms
              </h2>
              
              <div className="space-y-3">
                {symptoms.map((symptom, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={symptom}
                      onChange={(e) => updateSymptom(index, e.target.value)}
                      placeholder="Describe the problem (e.g., engine overheating, brake noise)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {symptoms.length > 1 && (
                      <button
                        onClick={() => removeSymptom(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={addSymptom}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Add Symptom
                </button>
                <button
                  onClick={diagnoseFault}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Diagnosing...
                    </>
                  ) : (
                    <>
                      <Wrench className="w-4 h-4 mr-2" />
                      Diagnose Fault
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />
                <p className="text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Right Column - Results Section */}
          <div className="space-y-6">
            {diagnosis ? (
              <>
                {/* Diagnosis Results */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-semibold mb-4 flex items-center">
                    <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                    AI Diagnosis Results
                  </h2>
                  
                  {diagnosis.diagnosis.predicted_faults && diagnosis.diagnosis.predicted_faults.length > 0 ? (
                    <div className="space-y-4">
                      {diagnosis.diagnosis.predicted_faults.map((fault, index) => (
                        <div key={index} className={`border-l-4 rounded-lg p-4 ${
                          fault.severity === 'critical' ? 'border-red-500 bg-red-50' :
                          fault.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                          fault.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                          'border-blue-500 bg-blue-50'
                        }`}>
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {fault.description}
                              </h3>
                              <p className="text-sm text-gray-600 mb-2">
                                Fault Code: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{fault.fault}</span>
                              </p>
                              {fault.triggered_by && (
                                <p className="text-xs text-gray-500">
                                  Triggered by: <span className="italic">{fault.triggered_by}</span>
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold mb-1 ${getConfidenceColor(fault.confidence)}`}>
                                {(fault.confidence * 100).toFixed(1)}%
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                fault.severity === 'critical' ? 'bg-red-100 text-red-800' :
                                fault.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                                fault.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {fault.severity?.toUpperCase()} PRIORITY
                              </span>
                            </div>
                          </div>
                          
                          {/* Show related parts count */}
                          {fault.parts && (
                            <div className="mt-3 p-3 bg-white rounded border">
                              <p className="text-sm text-gray-700">
                                <strong>Related Parts:</strong> {fault.parts.join(', ')}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {diagnosis.diagnosis.recommended_parts?.filter(p => p.fault_type === fault.fault).length || 0} parts found in inventory
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Analysis Summary */}
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold text-gray-800 mb-2">Analysis Summary</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Analysis Method</p>
                            <p className="font-medium">{diagnosis.diagnosis.analysis_method?.replace(/_/g, ' ').toUpperCase()}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">NLP Available</p>
                            <p className="font-medium">{diagnosis.diagnosis.nlp_available ? '✅ Yes' : '❌ No'}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Faults Detected</p>
                            <p className="font-medium">{diagnosis.diagnosis.predicted_faults.length}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Parts Found</p>
                            <p className="font-medium">{diagnosis.diagnosis.recommended_parts?.length || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-500 text-lg">No specific faults identified</p>
                      <p className="text-gray-400 text-sm mt-1">Please provide more detailed symptoms for better diagnosis</p>
                    </div>
                  )}
                </div>

                {/* Diagnostic Steps */}
                {diagnosis.diagnosis.diagnostic_steps && diagnosis.diagnosis.diagnostic_steps.length > 0 && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-blue-600" />
                      Recommended Diagnostic Steps
                    </h3>
                    <div className="space-y-3">
                      {diagnosis.diagnosis.diagnostic_steps.map((step, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-800">{step}</p>
                          </div>
                          <div className="flex-shrink-0">
                            <input 
                              type="checkbox" 
                              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                              title="Mark as completed"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>💡 Tip:</strong> Follow these steps in order for accurate diagnosis. 
                        Check off each step as you complete it.
                      </p>
                    </div>
                  </div>
                )}

                {/* Recommended Parts */}
                {diagnosis.diagnosis.recommended_parts && diagnosis.diagnosis.recommended_parts.length > 0 && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center">
                      <Package className="w-5 h-5 mr-2 text-purple-600" />
                      Recommended Parts ({diagnosis.diagnosis.recommended_parts.length})
                    </h3>
                    
                    {/* Parts Summary */}
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-blue-600">
                            {diagnosis.diagnosis.recommended_parts.filter(p => p.stock > 0).length}
                          </p>
                          <p className="text-sm text-gray-600">In Stock</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-orange-600">
                            {diagnosis.diagnosis.recommended_parts.filter(p => p.stock === 0).length}
                          </p>
                          <p className="text-sm text-gray-600">Out of Stock</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-600">
                            {diagnosis.diagnosis.recommended_parts.filter(p => p.is_vehicle_specific).length}
                          </p>
                          <p className="text-sm text-gray-600">Vehicle Specific</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-purple-600">
                            ₹{Math.min(...diagnosis.diagnosis.recommended_parts.filter(p => p.stock > 0).map(p => p.price)).toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-600">Lowest Price</p>
                        </div>
                      </div>
                    </div>

                    {/* Group parts by fault type and availability */}
                    {(() => {
                      const groupedParts = diagnosis.diagnosis.recommended_parts.reduce((acc, part) => {
                        const key = part.fault_type || 'general';
                        if (!acc[key]) acc[key] = { inStock: [], outOfStock: [] };
                        
                        if (part.stock > 0) {
                          acc[key].inStock.push(part);
                        } else {
                          acc[key].outOfStock.push(part);
                        }
                        return acc;
                      }, {});

                      return Object.entries(groupedParts).map(([faultType, parts]) => (
                        <div key={faultType} className="mb-6">
                          <h4 className="text-lg font-semibold mb-3 text-gray-800 capitalize border-b pb-2">
                            {faultType.replace(/_/g, ' ')} Parts
                          </h4>
                          
                          {/* In Stock Parts */}
                          {parts.inStock.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-md font-medium text-green-700 mb-2 flex items-center">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Available in Stock ({parts.inStock.length})
                              </h5>
                              <div className="grid gap-3">
                                {parts.inStock
                                  .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
                                  .map((part, index) => (
                                  <div key={`${part.item_code}-${index}`} className="border-l-4 border-green-500 bg-green-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center mb-1">
                                          <p className="font-semibold text-gray-900 mr-2">{part.item_name}</p>
                                          {part.is_vehicle_specific && (
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                              🎯 {vehicleInfo.model} Specific
                                            </span>
                                          )}
                                        </div>
                                        
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                                          <div>
                                            <span className="font-medium">Code:</span> {part.item_code}
                                          </div>
                                          {part.part_number && (
                                            <div>
                                              <span className="font-medium">Part #:</span> {part.part_number}
                                            </div>
                                          )}
                                          <div>
                                            <span className="font-medium">Category:</span> {part.category}
                                          </div>
                                          <div>
                                            <span className="font-medium">Brand:</span> {part.brand || 'Generic'}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="text-right ml-4">
                                        <div className="text-lg font-bold text-green-600">
                                          {formatCurrency(part.price)}
                                        </div>
                                        {part.mrp > part.price && (
                                          <div className="text-sm text-gray-500 line-through">
                                            MRP: {formatCurrency(part.mrp)}
                                          </div>
                                        )}
                                        <div className="text-sm font-medium text-green-700">
                                          Stock: {part.stock} {part.unit}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center mt-3">
                                      <div className="flex space-x-2">
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                          ✅ In Stock
                                        </span>
                                        {part.relevance_score && (
                                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                            Relevance: {part.relevance_score}%
                                          </span>
                                        )}
                                        {part.fault_confidence && (
                                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                                            Match: {(part.fault_confidence * 100).toFixed(0)}%
                                          </span>
                                        )}
                                      </div>
                                      
                                      <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
                                        Add to Quote
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Out of Stock Parts */}
                          {parts.outOfStock.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-md font-medium text-orange-700 mb-2 flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                Currently Out of Stock ({parts.outOfStock.length})
                              </h5>
                              <div className="grid gap-3">
                                {parts.outOfStock
                                  .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
                                  .slice(0, 5) // Show only top 5 out of stock items
                                  .map((part, index) => (
                                  <div key={`${part.item_code}-${index}`} className="border-l-4 border-orange-500 bg-orange-50 rounded-lg p-4 opacity-75">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center mb-1">
                                          <p className="font-semibold text-gray-700 mr-2">{part.item_name}</p>
                                          {part.is_vehicle_specific && (
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                              🎯 {vehicleInfo.model} Specific
                                            </span>
                                          )}
                                        </div>
                                        
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-600">
                                          <div>
                                            <span className="font-medium">Code:</span> {part.item_code}
                                          </div>
                                          <div>
                                            <span className="font-medium">Category:</span> {part.category}
                                          </div>
                                          <div>
                                            <span className="font-medium">Brand:</span> {part.brand || 'Generic'}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="text-right ml-4">
                                        <div className="text-lg font-bold text-gray-600">
                                          {formatCurrency(part.price)}
                                        </div>
                                        <div className="text-sm font-medium text-orange-600">
                                          Out of Stock
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center mt-3">
                                      <div className="flex space-x-2">
                                        <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                                          ⏳ Out of Stock
                                        </span>
                                        {part.relevance_score && (
                                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                            Relevance: {part.relevance_score}%
                                          </span>
                                        )}
                                      </div>
                                      
                                      <button className="px-4 py-2 bg-gray-400 text-white text-sm rounded cursor-not-allowed">
                                        Notify When Available
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              {parts.outOfStock.length > 5 && (
                                <p className="text-sm text-gray-500 mt-2 text-center">
                                  ... and {parts.outOfStock.length - 5} more out of stock items
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-12 text-center">
                <Wrench className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-xl text-gray-500">Enter vehicle symptoms to get AI diagnosis</p>
                <p className="text-sm text-gray-400 mt-2">
                  Our AI will analyze the symptoms and recommend appropriate spare parts
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaultDiagnosis;