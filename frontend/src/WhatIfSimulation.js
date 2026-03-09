import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Plus, Trash2, Play, RotateCcw } from 'lucide-react';

const WhatIfSimulation = ({ basePrediction, onRunSimulation }) => {
  const [scenarios, setScenarios] = useState([]);
  const [simulationResults, setSimulationResults] = useState(null);
  const [newScenario, setNewScenario] = useState({
    name: '',
    type: 'inflow',
    amount: '',
    day: '5'
  });

  const presetScenarios = [
    {
      name: 'Customer pays early',
      type: 'inflow',
      amount: 50000,
      day: 5,
      description: 'Major customer settles invoice early'
    },
    {
      name: 'Delay supplier payment',
      type: 'outflow',
      amount: -30000,
      day: 10,
      description: 'Negotiate 10-day payment extension'
    },
    {
      name: 'Sales drop 15%',
      type: 'inflow',
      amount: -basePrediction?.summary?.avg_daily_inflow * 0.15 || -10000,
      day: 1,
      description: 'Market slowdown affects sales'
    },
    {
      name: 'Unexpected expense',
      type: 'outflow',
      amount: 25000,
      day: 7,
      description: 'Equipment repair or emergency cost'
    },
    {
      name: 'Bulk order received',
      type: 'inflow',
      amount: 100000,
      day: 3,
      description: 'Large customer order payment'
    }
  ];

  const addScenario = () => {
    if (!newScenario.name || !newScenario.amount) {
      alert('Please fill in scenario name and amount');
      return;
    }

    setScenarios([...scenarios, {
      ...newScenario,
      amount: parseFloat(newScenario.amount),
      day: parseInt(newScenario.day)
    }]);

    setNewScenario({
      name: '',
      type: 'inflow',
      amount: '',
      day: '5'
    });
  };

  const addPresetScenario = (preset) => {
    setScenarios([...scenarios, preset]);
  };

  const removeScenario = (index) => {
    setScenarios(scenarios.filter((_, i) => i !== index));
  };

  const runSimulation = async () => {
    if (scenarios.length === 0) {
      alert('Please add at least one scenario');
      return;
    }

    const results = await onRunSimulation(scenarios);
    setSimulationResults(results);
  };

  const resetSimulation = () => {
    setScenarios([]);
    setSimulationResults(null);
  };

  const formatCurrency = (amount) => {
    return `₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
        <h3 className="text-2xl font-bold text-gray-800 mb-2">💡 What-If Simulation</h3>
        <p className="text-gray-600">
          Test different scenarios to see how they impact your cash flow. Add multiple scenarios and run simulations to make informed decisions.
        </p>
      </div>

      {/* Base Prediction Summary */}
      {basePrediction && (
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Base Prediction (30 days)</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(basePrediction.summary.predicted_final_balance)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Current Balance</p>
              <p className="text-lg font-semibold text-gray-700">
                {formatCurrency(basePrediction.summary.current_balance)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Scenario Builder */}
        <div className="space-y-6">
          {/* Quick Presets */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center">
              <span className="text-purple-600 mr-2">⚡</span>
              Quick Scenarios
            </h4>
            <div className="space-y-2">
              {presetScenarios.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => addPresetScenario(preset)}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{preset.name}</div>
                      <div className="text-xs text-gray-500">{preset.description}</div>
                    </div>
                    <div className={`text-sm font-semibold ${preset.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {preset.amount > 0 ? '+' : ''}{formatCurrency(preset.amount)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Scenario Builder */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-lg font-semibold mb-4 flex items-center">
              <span className="text-blue-600 mr-2">🎯</span>
              Custom Scenario
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scenario Name
                </label>
                <input
                  type="text"
                  value={newScenario.name}
                  onChange={(e) => setNewScenario({...newScenario, name: e.target.value})}
                  placeholder="e.g., Customer delays payment"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={newScenario.type}
                  onChange={(e) => setNewScenario({...newScenario, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="inflow">Cash Inflow (Increase/Decrease)</option>
                  <option value="outflow">Cash Outflow (Increase/Decrease)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={newScenario.amount}
                    onChange={(e) => setNewScenario({...newScenario, amount: e.target.value})}
                    placeholder="50000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Use negative for decrease</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Day
                  </label>
                  <input
                    type="number"
                    value={newScenario.day}
                    onChange={(e) => setNewScenario({...newScenario, day: e.target.value})}
                    min="1"
                    max="30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                onClick={addScenario}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span>Add Scenario</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Active Scenarios & Results */}
        <div className="space-y-6">
          {/* Active Scenarios */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold flex items-center">
                <span className="text-green-600 mr-2">📊</span>
                Active Scenarios ({scenarios.length})
              </h4>
              {scenarios.length > 0 && (
                <button
                  onClick={resetSimulation}
                  className="text-sm text-gray-600 hover:text-red-600 flex items-center space-x-1"
                >
                  <RotateCcw size={14} />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {scenarios.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No scenarios added yet</p>
                <p className="text-sm mt-2">Add scenarios from presets or create custom ones</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scenarios.map((scenario, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{scenario.name}</div>
                      <div className="text-xs text-gray-500">
                        Day {scenario.day} • {scenario.type === 'inflow' ? 'Inflow' : 'Outflow'}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-sm font-semibold ${scenario.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {scenario.amount > 0 ? '+' : ''}{formatCurrency(scenario.amount)}
                      </span>
                      <button
                        onClick={() => removeScenario(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {scenarios.length > 0 && (
              <button
                onClick={runSimulation}
                className="w-full mt-4 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg"
              >
                <Play size={18} />
                <span>Run Simulation</span>
              </button>
            )}
          </div>

          {/* Simulation Results */}
          {simulationResults && (
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-lg font-semibold mb-4 flex items-center">
                <span className="text-orange-600 mr-2">📈</span>
                Simulation Results
              </h4>

              <div className="space-y-4">
                {/* Base vs Modified */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-600 mb-1">Base Scenario</p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(simulationResults.base_final_balance)}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-600 mb-1">With Scenarios</p>
                    <p className="text-xl font-bold text-purple-900">
                      {formatCurrency(simulationResults.scenarios[simulationResults.scenarios.length - 1]?.modified_final_balance || 0)}
                    </p>
                  </div>
                </div>

                {/* Individual Scenario Impacts */}
                <div className="space-y-2">
                  {simulationResults.scenarios.map((result, idx) => (
                    <div key={idx} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{result.scenario_name}</span>
                        <span className={`text-sm font-semibold ${result.impact_on_final_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {result.impact_on_final_balance >= 0 ? '+' : ''}{formatCurrency(result.impact_on_final_balance)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Day {result.day} • {result.type}</span>
                        <span>{result.impact_percentage >= 0 ? '+' : ''}{result.impact_percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Impact */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Total Impact</span>
                    <span className={`text-lg font-bold ${
                      (simulationResults.scenarios[simulationResults.scenarios.length - 1]?.modified_final_balance - simulationResults.base_final_balance) >= 0 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {((simulationResults.scenarios[simulationResults.scenarios.length - 1]?.modified_final_balance - simulationResults.base_final_balance) >= 0 ? '+' : '')}
                      {formatCurrency(simulationResults.scenarios[simulationResults.scenarios.length - 1]?.modified_final_balance - simulationResults.base_final_balance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatIfSimulation;
