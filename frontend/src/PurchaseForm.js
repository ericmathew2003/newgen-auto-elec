import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    ListChecks,
    DollarSign,
    CheckCircle,
    ReceiptText,
    ArrowRight,
    Save,
    Loader2,
    ThumbsUp,
    Plus,
    Trash2,
    X
} from 'lucide-react';
import { usePermissions } from './hooks/usePermissions';
import { usePageNavigation } from './components/NavigationHelper';
import API_BASE_URL from './config/api';
import axios from 'axios';

// Helper to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// Step configuration
const STEPS = [
    { id: 1, title: 'Item Receipt & Draft', icon: ListChecks, status: 'Draft' },
    { id: 2, title: 'Overhead Costing', icon: DollarSign, status: 'Costing' },
    { id: 3, title: 'Confirmation & Approval', icon: ThumbsUp, status: 'Approved' },
    { id: 4, title: 'Post to Accounts', icon: ReceiptText, status: 'Posted' },
];

export default function PurchaseForm() {
    const { canCreate, canEdit, canView } = usePermissions();
    const { navigateToList } = usePageNavigation('/purchase');

    // State management
    const [currentStep, setCurrentStep] = useState(1);
    const [purchaseData, setPurchaseData] = useState({
        fyearid: new Date().getFullYear(),
        trdate: new Date().toISOString().split('T')[0],
        suppinvno: '',
        suppinvdt: new Date().toISOString().split('T')[0],
        partyid: '',
        remark: '',
        invamt: 0,
        tptcharge: 0,
        labcharge: 0,
        misccharge: 0,
        packcharge: 0,
        rounded: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        costsheetprepared: false,
        grnposted: false,
        costconfirmed: false,
        items: [],
        overheads: {
            freight: 0,
            duties: 0,
            insurance: 0,
            handling: 0
        },
        totalInvoice: 0,
        status: STEPS[0].status
    });

    // Data loading states
    const [suppliers, setSuppliers] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showItemModal, setShowItemModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [itemSearchTerm, setItemSearchTerm] = useState('');
    const [highlightIndex, setHighlightIndex] = useState(0);

    // Costing states (for Step 2)
    const [costingRows, setCostingRows] = useState([
        { OHType: 'Transportation', Amount: 0 },
        { OHType: 'Labour', Amount: 0 },
        { OHType: 'Misc', Amount: 0 }
    ]);
    const [costingPreview, setCostingPreview] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    // Modal item data
    const [modalItemData, setModalItemData] = useState({
        Qty: 0,
        Rate: 0,
        CGSTPer: 0,
        SGSTPer: 0,
        IGSTPer: 0,
        InvAmount: 0,
        CGSTAmount: 0,
        SGSTAmount: 0,
        IGSTAmount: 0,
        GTotal: 0
    });

    // Refs for modal navigation
    const searchInputRef = useRef(null);
    const listRef = useRef(null);
    const qtyInputRef = useRef(null);
    const rateInputRef = useRef(null);
    const saveAddNewRef = useRef(null);

    // Refs for costing navigation
    const tptAmtRef = useRef(null);
    const labAmtRef = useRef(null);
    const miscAmtRef = useRef(null);
    const saveCostingBtnRef = useRef(null);

    // Load initial data
    useEffect(() => {
        loadInitialData();
    }, []);

    // Auto-focus Transportation amount when Step 2 loads
    useEffect(() => {
        if (currentStep === 2) {
            setTimeout(() => {
                if (tptAmtRef.current) {
                    tptAmtRef.current.focus();
                    tptAmtRef.current.select();
                }
            }, 100);
        }
    }, [currentStep]);

    // Update purchase data when costing changes (Step 2)
    useEffect(() => {
        if (currentStep === 2) {
            const totalOverhead = costingRows.reduce((sum, row) => sum + (parseFloat(row.Amount) || 0), 0);
            const newOverheads = {
                freight: costingRows.find(r => r.OHType === 'Transportation')?.Amount || 0,
                labour: costingRows.find(r => r.OHType === 'Labour')?.Amount || 0,
                misc: costingRows.find(r => r.OHType === 'Misc')?.Amount || 0
            };

            const newTotal = purchaseData.invamt + totalOverhead;

            setPurchaseData(prev => ({
                ...prev,
                overheads: newOverheads,
                tptcharge: newOverheads.freight,
                labcharge: newOverheads.labour,
                misccharge: newOverheads.misc,
                totalInvoice: newTotal,
                status: STEPS[1].status,
            }));
        }
    }, [costingRows, purchaseData.invamt, currentStep]);

    const loadInitialData = async () => {
        try {
            setLoading(true);

            // Load suppliers (parties with partytype = 2)
            const suppliersResponse = await axios.get(`${API_BASE_URL}/api/party/all`, getAuthHeaders());
            const allParties = suppliersResponse.data || [];
            const onlySuppliers = allParties.filter(p => parseInt(p.partytype ?? 0, 10) === 2);
            const sortedSuppliers = [...onlySuppliers].sort((a, b) =>
                String(a.partyname || '').localeCompare(String(b.partyname || ''), undefined, { sensitivity: 'base' })
            );
            setSuppliers(sortedSuppliers);

            // Load items
            const itemsResponse = await axios.get(`${API_BASE_URL}/api/items/all`, getAuthHeaders());
            const itemsData = itemsResponse.data || [];
            console.log('Loaded items:', itemsData.length, 'items');
            setItems(itemsData);

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Utility functions
    const formatNumber = (num) => {
        if (num === null || num === undefined || num === '') return '0';
        return parseFloat(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const parseNumber = (str) => {
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    };

    // Calculate purchase totals
    const calculatePurchaseTotals = useMemo(() => {
        const items = purchaseData.items || [];

        const taxableTotal = items.reduce((sum, item) => sum + (item.invamount || 0), 0);
        const totalCGST = items.reduce((sum, item) => sum + (item.cgst || 0), 0);
        const totalSGST = items.reduce((sum, item) => sum + (item.sgst || 0), 0);
        const totalIGST = items.reduce((sum, item) => sum + (item.igst || 0), 0);
        const totalGST = totalCGST + totalSGST + totalIGST;
        const totalAfterGST = taxableTotal + totalGST;
        const roundedOff = Math.round(totalAfterGST) - totalAfterGST;
        const finalTotal = Math.round(totalAfterGST);

        return {
            taxableTotal,
            totalCGST,
            totalSGST,
            totalIGST,
            totalGST,
            totalAfterGST,
            roundedOff,
            finalTotal
        };
    }, [purchaseData.items]);

    // Input handlers - Direct state updates to avoid focus issues
    const handleInputChange = (field, value) => {
        setPurchaseData(prev => ({ ...prev, [field]: value }));
    };

    const handleRemoveItem = (index) => {
        const newItems = purchaseData.items.filter((_, i) => i !== index);

        // Recalculate totals
        const taxableTotal = newItems.reduce((sum, item) => sum + (item.invamount || 0), 0);
        const totalCGST = newItems.reduce((sum, item) => sum + (item.cgst || 0), 0);
        const totalSGST = newItems.reduce((sum, item) => sum + (item.sgst || 0), 0);
        const totalIGST = newItems.reduce((sum, item) => sum + (item.igst || 0), 0);
        const totalGST = totalCGST + totalSGST + totalIGST;
        const totalAfterGST = taxableTotal + totalGST;
        const roundedOff = Math.round(totalAfterGST) - totalAfterGST;
        const finalTotal = Math.round(totalAfterGST);

        setPurchaseData(prev => ({
            ...prev,
            items: newItems,
            invamt: taxableTotal,
            cgst: totalCGST,
            sgst: totalSGST,
            igst: totalIGST,
            rounded: roundedOff,
            totalInvoice: finalTotal
        }));
    };

    // Step navigation
    const handleNextStep = () => {
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
            setPurchaseData(prev => ({ ...prev, status: STEPS[currentStep].status }));
        }
    };

    const handleSaveData = () => {
        setPurchaseData(prev => ({ ...prev, status: STEPS[currentStep - 1].status }));
    };

    // Save purchase to database (Step 1)
    const handleSavePurchase = async () => {
        try {
            if (!purchaseData.partyid || purchaseData.items.length === 0) {
                alert('Please select a supplier and add at least one item before saving.');
                return;
            }

            // Get the selected financial year from localStorage (same as PurchasePage)
            let selectedFYearID = localStorage.getItem("selectedFYearID");
            
            // If no financial year is selected, default to 1 (2024)
            if (!selectedFYearID || selectedFYearID === "null" || selectedFYearID === "undefined") {
                console.warn('No financial year selected, defaulting to FYearID 1');
                selectedFYearID = "1";
                localStorage.setItem("selectedFYearID", "1");
            }

            // Ensure it's a valid number (1 or 2 based on available financial years)
            const fyearId = parseInt(selectedFYearID);
            if (fyearId !== 1 && fyearId !== 2) {
                console.warn(`Invalid financial year ID ${fyearId}, defaulting to 1`);
                selectedFYearID = "1";
                localStorage.setItem("selectedFYearID", "1");
            }

            console.log(`Using Financial Year ID: ${selectedFYearID}`);

            // Prepare items in the format expected by the complete endpoint
            const formattedItems = purchaseData.items.map(item => ({
                itemcode: parseInt(item.itemcode),
                qty: parseFloat(item.qty) || 0,
                rate: parseFloat(item.rate) || 0,
                taxableValue: parseFloat(item.invamount) || 0, // invamount is taxable value
                cgstAmt: parseFloat(item.cgst) || 0,
                sgstAmt: parseFloat(item.sgst) || 0,
                igstAmt: parseFloat(item.igst) || 0,
                lineTotal: parseFloat(item.lineTotal) || 0,
                cgstPer: parseFloat(item.cgstp) || 0,
                sgstPer: parseFloat(item.sgstp) || 0,
                igstPer: parseFloat(item.igstp) || 0
            }));

            // Prepare overheads from costing data
            const overheads = {};
            if (purchaseData.costingData) {
                Object.entries(purchaseData.costingData).forEach(([key, value]) => {
                    if (value && parseFloat(value) > 0) {
                        overheads[key] = parseFloat(value);
                    }
                });
            }

            const completePayload = {
                fyearid: parseInt(selectedFYearID), // Use selected accounting period from localStorage
                trdate: purchaseData.trdate,
                suppinvno: purchaseData.suppinvno || '',
                suppinvdt: purchaseData.suppinvdt || purchaseData.trdate,
                partyid: parseInt(purchaseData.partyid),
                remark: purchaseData.remark || '',
                items: formattedItems,
                overheads: overheads,
                tptcharge: parseFloat(purchaseData.tptcharge) || 0,
                labcharge: parseFloat(purchaseData.labcharge) || 0,
                misccharge: parseFloat(purchaseData.misccharge) || 0,
                packcharge: 0,
                costsheetprepared: purchaseData.status === 'costing_confirmed',
                grnposted: true,
                costconfirmed: purchaseData.status === 'costing_confirmed'
            };

            console.log('Sending complete purchase:', completePayload);

            const response = await axios.post(`${API_BASE_URL}/api/purchase/complete`, completePayload, getAuthHeaders());

            console.log('Complete purchase response:', response.data);

            if (response.data.success && response.data.tranid) {
                // Update purchase data with the returned transaction ID
                setPurchaseData(prev => ({
                    ...prev,
                    tranid: response.data.tranid, // Use lowercase tranid from backend
                    trno: response.data.trno,     // Use lowercase trno from backend
                    fyearid: selectedFYearID, // Update with correct fyearid
                    status: STEPS[0].status
                }));

                alert(`Purchase saved successfully! Transaction ID: ${response.data.tranid}`);
                return response.data.tranid; // Return the transaction ID for use by calling functions
            } else {
                throw new Error('No transaction ID returned from server');
            }
        } catch (error) {
            console.error('Error saving purchase:', error);
            console.error('Error response:', error.response?.data);
            alert(`Error saving purchase: ${error.response?.data?.error || error.message}`);
            throw error; // Re-throw so calling functions know it failed
        }
    };

    // Costing functions for Step 2
    const handleCostingAmountKeyDown = (e, current) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (current === 'tpt' && labAmtRef.current) {
                labAmtRef.current.focus();
                labAmtRef.current.select();
            } else if (current === 'lab' && miscAmtRef.current) {
                miscAmtRef.current.focus();
                miscAmtRef.current.select();
            } else if (current === 'misc' && saveCostingBtnRef.current) {
                saveCostingBtnRef.current.focus();
            }
        }
    };

    const handleSaveCosting = async () => {
        setIsSaving(true);
        try {
            if (purchaseData.tranid) {
                // Save costing data to backend
                await axios.put(`${API_BASE_URL}/api/purchase/${purchaseData.tranid}/costing`,
                    { rows: costingRows },
                    getAuthHeaders()
                );
                console.log('Costing saved successfully');
                alert('Costing saved successfully!');
            } else {
                console.log('No transaction ID available for saving costing');
                alert('Please save the purchase first before adding costing.');
            }
        } catch (error) {
            console.error('Error saving costing:', error);
            alert('Error saving costing. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePreviewAllocation = () => {
        const items = purchaseData.items || [];
        const totalInvAmount = items.reduce((sum, item) => sum + (item.invamount || 0), 0);
        const totalOverhead = costingRows.reduce((sum, row) => sum + (parseFloat(row.Amount) || 0), 0);

        const preview = items.map((item, index) => {
            const share = totalInvAmount > 0 ? (item.invamount / totalInvAmount) : 0;
            const ohAmount = Number((share * totalOverhead).toFixed(2));
            const netRate = Number((item.rate + (item.qty > 0 ? ohAmount / item.qty : 0)).toFixed(2));
            const lineTotal = Number((item.invamount + ohAmount).toFixed(2));

            return {
                srno: index + 1,
                itemname: item.itemname,
                qty: item.qty,
                rate: item.rate,
                invamount: item.invamount,
                ohamt: ohAmount,
                netrate: netRate,
                linetotal: lineTotal
            };
        });

        setCostingPreview(preview);
        setShowPreview(true);
    };

    const handleConfirmCosting = async () => {
        setIsConfirming(true);
        try {
            let preview = costingPreview;
            if (!preview || preview.length === 0) {
                handlePreviewAllocation();
                preview = costingPreview;
            }

            if (purchaseData.tranid) {
                // Confirm costing to backend
                await axios.post(`${API_BASE_URL}/api/purchase/${purchaseData.tranid}/costing/confirm`,
                    { items: preview },
                    getAuthHeaders()
                );

                console.log('Costing confirmed successfully');

                const updatedData = {
                    ...purchaseData,
                    costsheetprepared: true,
                    costconfirmed: true,
                    status: STEPS[2].status
                };

                setPurchaseData(updatedData);
                setCurrentStep(3);
            } else {
                console.log('No transaction ID available for confirming costing');
                alert('Please save the purchase first before confirming costing.');
            }
        } catch (error) {
            console.error('Error confirming costing:', error);
            alert('Error confirming costing. Please try again.');
        } finally {
            setIsConfirming(false);
        }
    };

    // Modal functions
    const filteredItems = useMemo(() => {
        return items.filter(item =>
            item.itemname.toLowerCase().includes(itemSearchTerm.toLowerCase())
        );
    }, [items, itemSearchTerm]);

    const selectItemInModal = (item) => {
        console.log('Selected item GST data:', {
            itemname: item.itemname,
            cgst: item.cgst,
            sgst: item.sgst,
            igst: item.igst,
            cost: item.cost
        });

        setSelectedItem(item);
        setModalItemData({
            Qty: 1,
            Rate: item.cost || 0,
            CGSTPer: item.cgst || 0,
            SGSTPer: item.sgst || 0,
            IGSTPer: item.igst || 0,
            InvAmount: item.cost || 0,
            CGSTAmount: 0,
            SGSTAmount: 0,
            IGSTAmount: 0,
            GTotal: item.cost || 0
        });

        // Calculate totals with the item's GST percentages
        calculateModalTotals(item, 1, item.cost || 0, item.cgst || 0, item.sgst || 0, item.igst || 0);

        setTimeout(() => {
            if (qtyInputRef.current) {
                qtyInputRef.current.focus();
                qtyInputRef.current.select();
            }
        }, 100);
    };

    const calculateModalTotals = (item, qty, rate, cgstPer, sgstPer, igstPer) => {
        const invAmount = qty * rate;
        const cgstAmount = (invAmount * cgstPer) / 100;
        const sgstAmount = (invAmount * sgstPer) / 100;
        const igstAmount = (invAmount * igstPer) / 100;
        const gTotal = invAmount + cgstAmount + sgstAmount + igstAmount;

        setModalItemData({
            Qty: qty,
            Rate: rate,
            CGSTPer: cgstPer,
            SGSTPer: sgstPer,
            IGSTPer: igstPer,
            InvAmount: invAmount,
            CGSTAmount: cgstAmount,
            SGSTAmount: sgstAmount,
            IGSTAmount: igstAmount,
            GTotal: gTotal
        });
    };

    const addItemToForm = () => {
        if (!selectedItem || modalItemData.Qty <= 0) return;

        const newItem = {
            id: Date.now(),
            itemcode: selectedItem.itemcode,
            itemname: selectedItem.itemname,
            qty: modalItemData.Qty,
            rate: modalItemData.Rate,
            invamount: modalItemData.InvAmount,
            cgst: modalItemData.CGSTAmount,
            sgst: modalItemData.SGSTAmount,
            igst: modalItemData.IGSTAmount,
            gtotal: modalItemData.GTotal,
            cgstp: modalItemData.CGSTPer,
            sgstp: modalItemData.SGSTPer,
            igstp: modalItemData.IGSTPer,
            lineTotal: modalItemData.GTotal
        };

        const newItems = [...purchaseData.items, newItem];

        // Calculate totals
        const taxableTotal = newItems.reduce((sum, item) => sum + (item.invamount || 0), 0);
        const totalCGST = newItems.reduce((sum, item) => sum + (item.cgst || 0), 0);
        const totalSGST = newItems.reduce((sum, item) => sum + (item.sgst || 0), 0);
        const totalIGST = newItems.reduce((sum, item) => sum + (item.igst || 0), 0);
        const totalGST = totalCGST + totalSGST + totalIGST;
        const totalAfterGST = taxableTotal + totalGST;
        const roundedOff = Math.round(totalAfterGST) - totalAfterGST;
        const finalTotal = Math.round(totalAfterGST);

        setPurchaseData(prev => ({
            ...prev,
            items: newItems,
            invamt: taxableTotal,
            cgst: totalCGST,
            sgst: totalSGST,
            igst: totalIGST,
            rounded: roundedOff,
            totalInvoice: finalTotal
        }));

        setShowItemModal(false);
        setSelectedItem(null);
        setItemSearchTerm('');
    };

    const addItemAndContinue = () => {
        addItemToForm();
        setSelectedItem(null);
        setItemSearchTerm('');
        setHighlightIndex(0);

        setTimeout(() => {
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        }, 100);
    };

    const handleListKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredItems[highlightIndex]) {
                selectItemInModal(filteredItems[highlightIndex]);
            }
        }
    };

    // Components
    const StepIndicator = ({ step }) => (
        <div className="flex justify-between items-center space-x-2 w-full mb-8 p-4 bg-white rounded-xl shadow-lg">
            {STEPS.map((s, index) => (
                <React.Fragment key={s.id}>
                    <div className="flex flex-col items-center">
                        <div className={`p-3 rounded-full transition-all duration-300 ${s.id === step ? 'bg-indigo-600 text-white shadow-xl' :
                            s.id < step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                            }`}>
                            <s.icon className="w-6 h-6" />
                        </div>
                        <p className={`mt-2 text-center text-xs font-medium ${s.id === step ? 'text-indigo-600 font-semibold' : 'text-gray-500'
                            }`}>
                            {s.title}
                        </p>
                    </div>
                    {index < STEPS.length - 1 && (
                        <div className={`flex-auto h-0.5 transition-colors duration-300 ${s.id < step ? 'bg-green-500' : 'bg-gray-300'
                            }`}></div>
                    )}
                </React.Fragment>
            ))}
        </div>
    );

    const InvoiceSummary = ({ invoiceData }) => {
        const { invamt, totalInvoice, overheads } = invoiceData;
        const calculateTotalOverheads = useMemo(() => {
            return Object.values(overheads).reduce((sum, cost) => sum + cost, 0);
        }, [overheads]);

        return (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 mt-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Invoice Summary</h3>
                <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                        <span>Item Subtotal:</span>
                        <span className="font-medium text-indigo-600">₹{formatNumber(invamt.toFixed(2))}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Total Overheads:</span>
                        <span className="font-medium text-orange-500">₹{formatNumber(calculateTotalOverheads.toFixed(2))}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-300 font-bold text-base">
                        <span>TOTAL INVOICE COST:</span>
                        <span className="text-green-600">₹{formatNumber(totalInvoice.toFixed(2))}</span>
                    </div>
                </div>
            </div>
        );
    };

    // Step 2: Overhead Costing
    const Step2Form = ({ data, onSave, onNext }) => {
        const [costingRows, setCostingRows] = useState([
            { OHType: 'Transportation', Amount: 0 },
            { OHType: 'Labour', Amount: 0 },
            { OHType: 'Misc', Amount: 0 }
        ]);
        const [costingPreview, setCostingPreview] = useState([]);
        const [showPreview, setShowPreview] = useState(false);
        const [isSaving, setIsSaving] = useState(false);
        const [isConfirming, setIsConfirming] = useState(false);

        // Refs for keyboard navigation
        const tptAmtRef = useRef(null);
        const labAmtRef = useRef(null);
        const miscAmtRef = useRef(null);
        const saveCostingBtnRef = useRef(null);

        // Auto-focus Transportation amount when component loads
        useEffect(() => {
            setTimeout(() => {
                if (tptAmtRef.current) {
                    tptAmtRef.current.focus();
                    tptAmtRef.current.select();
                }
            }, 100);
        }, []);

        // Handle keyboard navigation
        const handleCostingAmountKeyDown = (e, current) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (current === 'tpt' && labAmtRef.current) {
                    labAmtRef.current.focus();
                    labAmtRef.current.select();
                } else if (current === 'lab' && miscAmtRef.current) {
                    miscAmtRef.current.focus();
                    miscAmtRef.current.select();
                } else if (current === 'misc' && saveCostingBtnRef.current) {
                    saveCostingBtnRef.current.focus();
                }
            }
        };

        // Calculate total overhead
        const totalOverhead = costingRows.reduce((sum, row) => sum + (parseFloat(row.Amount) || 0), 0);

        // Update parent data when costing changes
        useEffect(() => {
            const newOverheads = {
                freight: costingRows.find(r => r.OHType === 'Transportation')?.Amount || 0,
                labour: costingRows.find(r => r.OHType === 'Labour')?.Amount || 0,
                misc: costingRows.find(r => r.OHType === 'Misc')?.Amount || 0
            };

            const newTotal = data.invamt + totalOverhead;

            onSave({
                ...data,
                overheads: newOverheads,
                tptcharge: newOverheads.freight,
                labcharge: newOverheads.labour,
                misccharge: newOverheads.misc,
                totalInvoice: newTotal,
                status: STEPS[1].status,
            });
        }, [costingRows, data.invamt, totalOverhead]);

        // Save costing to backend
        const handleSaveCosting = async () => {
            setIsSaving(true);
            try {
                // In a real implementation, you would save to the backend here
                // await axios.put(`${API_BASE_URL}/api/purchase/${data.tranid}/costing`, { rows: costingRows }, getAuthHeaders());
                console.log('Saving costing rows:', costingRows);
                alert('Costing saved successfully!');
            } catch (error) {
                console.error('Error saving costing:', error);
                alert('Error saving costing. Please try again.');
            } finally {
                setIsSaving(false);
            }
        };

        // Preview allocation - distribute overhead across items by value
        const handlePreviewAllocation = () => {
            const items = data.items || [];
            const totalInvAmount = items.reduce((sum, item) => sum + (item.invamount || 0), 0);

            const preview = items.map((item, index) => {
                const share = totalInvAmount > 0 ? (item.invamount / totalInvAmount) : 0;
                const ohAmount = Number((share * totalOverhead).toFixed(2));
                const netRate = Number((item.rate + (item.qty > 0 ? ohAmount / item.qty : 0)).toFixed(2));
                const lineTotal = Number((item.invamount + ohAmount).toFixed(2));

                return {
                    srno: index + 1,
                    itemname: item.itemname,
                    qty: item.qty,
                    rate: item.rate,
                    invamount: item.invamount,
                    ohamt: ohAmount,
                    netrate: netRate,
                    linetotal: lineTotal
                };
            });

            setCostingPreview(preview);
            setShowPreview(true);
        };

        // Confirm costing - finalize the allocation
        const handleConfirmCosting = async () => {
            setIsConfirming(true);
            try {
                // Generate preview if not already done
                let preview = costingPreview;
                if (!preview || preview.length === 0) {
                    handlePreviewAllocation();
                    preview = costingPreview;
                }

                // In a real implementation, you would confirm costing to the backend here
                // await axios.post(`${API_BASE_URL}/api/purchase/${data.tranid}/costing/confirm`, { items: preview }, getAuthHeaders());
                console.log('Confirming costing with preview:', preview);

                // Update the data with confirmed costing
                const updatedData = {
                    ...data,
                    costsheetprepared: true,
                    costconfirmed: true,
                    status: STEPS[2].status
                };

                onNext(updatedData);
            } catch (error) {
                console.error('Error confirming costing:', error);
                alert('Error confirming costing. Please try again.');
            } finally {
                setIsConfirming(false);
            }
        };

        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">2. Prepare Overhead Costing</h2>
                <p className="text-gray-600">Allocate ancillary costs (freight, duties, etc.) to the purchase to determine the true landed cost. These costs will be capitalized.</p>

                {/* Costing Input Section */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-semibold mb-4 border-b pb-2">Overhead Details (Amounts)</h3>

                    <div className="space-y-4">
                        {costingRows.map((row, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-4 py-3 border-b last:border-b-0">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={row.OHType}
                                        onChange={(e) => {
                                            const newRows = [...costingRows];
                                            newRows[idx] = { ...newRows[idx], OHType: e.target.value };
                                            setCostingRows(newRows);
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Cost Head"
                                    />
                                </div>
                                <div className="w-48">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500">₹</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={row.Amount || ''}
                                            onChange={(e) => {
                                                const newRows = [...costingRows];
                                                newRows[idx] = { ...newRows[idx], Amount: parseFloat(e.target.value) || 0 };
                                                setCostingRows(newRows);
                                            }}
                                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-right"
                                            placeholder="0.00"
                                            step="0.01"
                                            ref={
                                                row.OHType === 'Transportation' ? tptAmtRef :
                                                    row.OHType === 'Labour' ? labAmtRef :
                                                        row.OHType === 'Misc' ? miscAmtRef : null
                                            }
                                            onKeyDown={(e) => {
                                                if (row.OHType === 'Transportation') handleCostingAmountKeyDown(e, 'tpt');
                                                if (row.OHType === 'Labour') handleCostingAmountKeyDown(e, 'lab');
                                                if (row.OHType === 'Misc') handleCostingAmountKeyDown(e, 'misc');
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Total Overhead */}
                        <div className="flex items-center justify-between pt-4 border-t-2 border-indigo-200">
                            <span className="text-lg font-semibold text-gray-700">Total Overhead:</span>
                            <span className="text-lg font-bold text-orange-500">₹{formatNumber(totalOverhead.toFixed(2))}</span>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-800 mb-2">Instructions:</h4>
                        <ul className="list-disc ml-5 text-sm text-blue-700 space-y-1">
                            <li>Enter overhead amounts (Transportation, Labour, Misc).</li>
                            <li>Click "Save Costing" to persist overheads.</li>
                            <li>Click "Preview Allocation" to compute item-wise distribution by value.</li>
                            <li>Click "Confirm Costing" to finalize and lock costing.</li>
                        </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3 mt-6">
                        <button
                            ref={saveCostingBtnRef}
                            onClick={handleSaveCosting}
                            disabled={isSaving}
                            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save Costing'}
                        </button>

                        <button
                            onClick={handlePreviewAllocation}
                            disabled={totalOverhead === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            Preview Allocation
                        </button>

                        <button
                            onClick={handleConfirmCosting}
                            disabled={isConfirming || totalOverhead === 0}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {isConfirming ? 'Confirming...' : 'Confirm Costing'}
                        </button>
                    </div>
                </div>

                {/* Preview Allocation Table */}
                {showPreview && costingPreview.length > 0 && (
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold mb-4 border-b pb-2">Costing Allocation Preview</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Inv Amt</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">OH Amt</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Net Rate</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Line Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {costingPreview.map((row, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {row.itemname}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                {formatNumber(row.qty.toFixed(2))}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                ₹{formatNumber(row.rate.toFixed(2))}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                ₹{formatNumber(row.invamount.toFixed(2))}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-orange-600 text-right">
                                                ₹{formatNumber(row.ohamt.toFixed(2))}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-indigo-600 text-right">
                                                ₹{formatNumber(row.netrate.toFixed(2))}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                                ₹{formatNumber(row.linetotal.toFixed(2))}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Totals Row */}
                                    <tr className="bg-gray-50 font-semibold">
                                        <td className="px-3 py-3 text-sm text-gray-900">Totals</td>
                                        <td className="px-3 py-3"></td>
                                        <td className="px-3 py-3"></td>
                                        <td className="px-3 py-3 text-sm text-gray-900 text-right">
                                            ₹{formatNumber(costingPreview.reduce((sum, row) => sum + row.invamount, 0).toFixed(2))}
                                        </td>
                                        <td className="px-3 py-3 text-sm font-bold text-orange-600 text-right">
                                            ₹{formatNumber(costingPreview.reduce((sum, row) => sum + row.ohamt, 0).toFixed(2))}
                                        </td>
                                        <td className="px-3 py-3"></td>
                                        <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">
                                            ₹{formatNumber(costingPreview.reduce((sum, row) => sum + row.linetotal, 0).toFixed(2))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <InvoiceSummary invoiceData={data} />

                <div className="flex justify-end space-x-4 pt-4 border-t">
                    <button
                        onClick={() => onNext({ ...data, status: STEPS[2].status })}
                        className="flex items-center px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition duration-150 shadow-lg"
                    >
                        Submit for Confirmation <ArrowRight className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        );
    };

    // Step 3: Confirmation & Approval
    const Step3Form = ({ data, onSave, onNext }) => {
        const [isApproving, setIsApproving] = useState(false);

        const handleApprove = async () => {
            setIsApproving(true);
            try {
                if (data.tranid) {
                    // Update purchase status to approved in backend
                    await axios.put(`${API_BASE_URL}/api/purchase/${data.tranid}`,
                        {
                            ...data,
                            costsheetprepared: true,
                            costconfirmed: true,
                            grnposted: true
                        },
                        getAuthHeaders()
                    );

                    console.log('Purchase approved successfully');
                    onNext({ ...data, status: STEPS[3].status });
                } else {
                    alert('No transaction ID available. Please save the purchase first.');
                }
            } catch (error) {
                console.error('Error approving purchase:', error);
                alert('Error approving purchase. Please try again.');
            } finally {
                setIsApproving(false);
            }
        };

        const selectedSupplier = suppliers.find(s => s.partyid === parseInt(data.partyid));
        const totalOverheads = Object.values(data.overheads).reduce((sum, cost) => sum + cost, 0);
        const totalInvoice = data.invamt + totalOverheads;

        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">3. Purchase Confirmation (Manager Approval)</h2>
                <p className="text-gray-600">Review all receipt and costing details. Confirmation locks the invoice values before they are sent to the Accounting Ledger.</p>

                <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                    <h3 className="text-xl font-semibold text-indigo-700">Final Review</h3>
                    <p className="text-sm text-gray-700">Items and costs are finalized. Proceeding confirms the liability and the true landed cost of goods.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-medium text-gray-700 mb-2">Supplier Information</h4>
                            <p className="text-sm text-gray-600">Name: {selectedSupplier?.partyname}</p>
                            <p className="text-sm text-gray-600">Invoice No: {data.suppinvno}</p>
                            <p className="text-sm text-gray-600">Invoice Date: {data.suppinvdt}</p>
                            <p className="text-sm text-gray-600">Purchase Date: {data.trdate}</p>
                        </div>

                        <div>
                            <h4 className="font-medium text-gray-700 mb-2">Financial Summary</h4>
                            <div className="flex justify-between border-t pt-4">
                                <span className="font-medium">Total Item Value:</span>
                                <span className="text-green-600 font-bold">₹{formatNumber(data.invamt.toFixed(2))}</span>
                            </div>
                            <div className="flex justify-between border-b pb-4">
                                <span className="font-medium">Total Overheads:</span>
                                <span className="text-orange-500 font-bold">₹{formatNumber(totalOverheads.toFixed(2))}</span>
                            </div>
                            <div className="flex justify-between font-extrabold text-xl">
                                <span>TOTAL AMOUNT DUE:</span>
                                <span className="text-indigo-800">₹{formatNumber(totalInvoice.toFixed(2))}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-4 pt-4 border-t">
                    <button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition duration-150 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isApproving ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Approving...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5 mr-2" /> Confirm & Approve Purchase
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    // Step 4: Post to Accounts
    const Step4Form = ({ data, onNext }) => {
        const [isPosting, setIsPosting] = useState(false);

        const handlePost = async () => {
            if (!canCreate('INVENTORY', 'PURCHASE')) {
                alert('You do not have permission to create purchases');
                return;
            }

            setIsPosting(true);
            try {
                const purchasePayload = {
                    ...data,
                    grnposted: true,
                    costsheetprepared: true,
                    costconfirmed: true
                };

                const response = await axios.post(`${API_BASE_URL}/api/purchase/complete`, purchasePayload, getAuthHeaders());
                onNext({ ...data, trno: response.data.trno, grnposted: true, status: 'Posted' });
            } catch (error) {
                console.error('Error posting purchase:', error);
                alert('Error posting purchase to accounts. Please try again.');
            } finally {
                setIsPosting(false);
            }
        };

        const totalOverheads = Object.values(data.overheads).reduce((sum, cost) => sum + cost, 0);
        const totalInvoice = data.invamt + totalOverheads;

        if (data.status === 'Posted') {
            return (
                <div className="text-center p-10 bg-green-50 rounded-xl shadow-xl border-4 border-green-400">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-3xl font-bold text-green-700">Invoice Successfully Posted!</h2>
                    <p className="text-lg text-gray-600 mt-2">
                        The purchase invoice (INV-{data.trno}) has been recorded in the General Ledger.
                        Total Landed Cost: <span className="font-extrabold">₹{formatNumber(totalInvoice.toFixed(2))}</span>
                    </p>
                    <p className="text-sm mt-4 text-gray-500">Inventory and Accounts Payable have been updated.</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">4. Post to Accounts Ledger</h2>
                <p className="text-gray-600">The invoice is approved and finalized. The final action is to create the corresponding journal entries in the General Ledger (e.g., Debit: Inventory/Asset, Credit: Accounts Payable).</p>

                <div className="bg-white p-6 rounded-xl shadow-md border-2 border-indigo-300 space-y-4">
                    <h3 className="text-xl font-semibold text-indigo-700">Accounting Entry Preview</h3>
                    <p className="text-sm font-mono bg-gray-100 p-3 rounded-md">
                        Date: {new Date().toLocaleDateString()}<br />
                        Invoice #: INV-{data.suppinvno}<br />
                        <span className="font-bold block mt-2">DR: Inventory/Fixed Asset (Landed Cost): ₹{formatNumber(totalInvoice.toFixed(2))}</span><br />
                        <span className="font-bold block">CR: Accounts Payable: ₹{formatNumber(totalInvoice.toFixed(2))}</span>
                    </p>
                    <div className="mt-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800">
                        <p className="font-medium">Action Required:</p>
                        <p className="text-sm">Click 'Post' to permanently record this transaction in the company's financial records.</p>
                    </div>
                </div>

                <div className="flex justify-between pt-4 border-t">
                    <button
                        onClick={() => {
                            // Navigate back to purchase list
                            window.location.href = '/purchase';
                        }}
                        className="flex items-center px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition duration-150 shadow-md"
                    >
                        <X className="w-5 h-5 mr-2" /> Close
                    </button>
                    
                    <button
                        onClick={handlePost}
                        disabled={isPosting}
                        className="flex items-center px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition duration-150 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPosting ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Posting...
                            </>
                        ) : (
                            <>
                                <ReceiptText className="w-5 h-5 mr-2" /> Post Invoice to Ledger
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    // Main render function
    const renderCurrentForm = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-800">1. Item Receipt & Save Draft</h2>
                        <p className="text-gray-600">Enter receipt details and save the invoice as a Draft. This confirms physical receipt of goods.</p>

                        {/* Purchase Header Information */}
                        <div className="bg-white p-6 rounded-xl shadow-md">
                            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Purchase Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                                    <select
                                        value={purchaseData.partyid}
                                        onChange={(e) => handleInputChange('partyid', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        <option value="">Select Supplier</option>
                                        {suppliers.map(supplier => (
                                            <option key={supplier.partyid} value={supplier.partyid}>
                                                {supplier.partyname}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                                    <input
                                        type="date"
                                        value={purchaseData.trdate}
                                        onChange={(e) => handleInputChange('trdate', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Invoice No</label>
                                    <input
                                        type="text"
                                        value={purchaseData.suppinvno}
                                        onChange={(e) => handleInputChange('suppinvno', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Enter supplier invoice number"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Invoice Date</label>
                                    <input
                                        type="date"
                                        value={purchaseData.suppinvdt}
                                        onChange={(e) => handleInputChange('suppinvdt', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                                <textarea
                                    value={purchaseData.remark}
                                    onChange={(e) => handleInputChange('remark', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    rows="2"
                                    placeholder="Enter any remarks or notes"
                                />
                            </div>
                        </div>

                        {/* Received Items */}
                        <div className="bg-white p-6 rounded-xl shadow-md">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold border-b pb-2">Received Items</h3>
                                <button
                                    onClick={() => {
                                        console.log('Opening item modal, items available:', items.length);
                                        setShowItemModal(true);
                                    }}
                                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Item
                                </button>
                            </div>

                            {purchaseData.items.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <ListChecks className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                    <p>No items added yet. Click "Add Item" to start.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Taxable</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">GST</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {purchaseData.items.map((item, index) => (
                                                <tr key={item.id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        <div>
                                                            <div className="font-medium">{item.itemname}</div>
                                                            <div className="text-xs text-gray-500">Code: {item.itemcode}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-center">
                                                        {formatNumber(item.qty)}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                        ₹{formatNumber(item.rate.toFixed(2))}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                        ₹{formatNumber(item.invamount.toFixed(2))}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                        <div className="text-xs">
                                                            {item.cgst > 0 && <div>C: ₹{formatNumber(item.cgst.toFixed(2))}</div>}
                                                            {item.sgst > 0 && <div>S: ₹{formatNumber(item.sgst.toFixed(2))}</div>}
                                                            {item.igst > 0 && <div>I: ₹{formatNumber(item.igst.toFixed(2))}</div>}
                                                            <div className="font-medium border-t pt-1">₹{formatNumber((item.cgst + item.sgst + item.igst).toFixed(2))}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                                        ₹{formatNumber(item.lineTotal.toFixed(2))}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-center">
                                                        <button
                                                            onClick={() => handleRemoveItem(index)}
                                                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                                            title="Remove Item"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Purchase Summary */}
                        {purchaseData.items.length > 0 && (
                            <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-indigo-500">
                                <h3 className="text-lg font-semibold mb-4 text-indigo-700">Purchase Summary</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Left Column - Tax Breakdown */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                                            <span className="text-sm font-medium text-gray-600">Taxable Total:</span>
                                            <span className="text-sm font-semibold text-gray-900">₹{formatNumber(calculatePurchaseTotals.taxableTotal.toFixed(2))}</span>
                                        </div>

                                        {calculatePurchaseTotals.totalCGST > 0 && (
                                            <div className="flex justify-between items-center py-2 border-b border-gray-200">
                                                <span className="text-sm font-medium text-gray-600">Total CGST:</span>
                                                <span className="text-sm font-semibold text-orange-600">₹{formatNumber(calculatePurchaseTotals.totalCGST.toFixed(2))}</span>
                                            </div>
                                        )}

                                        {calculatePurchaseTotals.totalSGST > 0 && (
                                            <div className="flex justify-between items-center py-2 border-b border-gray-200">
                                                <span className="text-sm font-medium text-gray-600">Total SGST:</span>
                                                <span className="text-sm font-semibold text-orange-600">₹{formatNumber(calculatePurchaseTotals.totalSGST.toFixed(2))}</span>
                                            </div>
                                        )}

                                        {calculatePurchaseTotals.totalIGST > 0 && (
                                            <div className="flex justify-between items-center py-2 border-b border-gray-200">
                                                <span className="text-sm font-medium text-gray-600">Total IGST:</span>
                                                <span className="text-sm font-semibold text-orange-600">₹{formatNumber(calculatePurchaseTotals.totalIGST.toFixed(2))}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center py-2 border-b-2 border-orange-300">
                                            <span className="text-sm font-semibold text-gray-700">Total GST:</span>
                                            <span className="text-sm font-bold text-orange-700">₹{formatNumber(calculatePurchaseTotals.totalGST.toFixed(2))}</span>
                                        </div>
                                    </div>

                                    {/* Right Column - Final Totals */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                                            <span className="text-sm font-medium text-gray-600">Total Amount (after GST):</span>
                                            <span className="text-sm font-semibold text-gray-900">₹{formatNumber(calculatePurchaseTotals.totalAfterGST.toFixed(2))}</span>
                                        </div>

                                        <div className="flex justify-between items-center py-2 border-b border-gray-200">
                                            <span className="text-sm font-medium text-gray-600">Rounded Off:</span>
                                            <span className={`text-sm font-semibold ${calculatePurchaseTotals.roundedOff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {calculatePurchaseTotals.roundedOff >= 0 ? '+' : ''}₹{formatNumber(Math.abs(calculatePurchaseTotals.roundedOff).toFixed(2))}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-3 bg-indigo-50 px-4 rounded-lg border-2 border-indigo-200">
                                            <span className="text-lg font-bold text-indigo-800">Final Total:</span>
                                            <span className="text-xl font-extrabold text-indigo-900">₹{formatNumber(calculatePurchaseTotals.finalTotal.toFixed(2))}</span>
                                        </div>

                                        {/* Item Count Summary */}
                                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-600">Total Items:</span>
                                                <span className="text-sm font-semibold text-gray-900">{purchaseData.items.length}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-sm font-medium text-gray-600">Total Quantity:</span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {formatNumber(purchaseData.items.reduce((sum, item) => sum + (item.qty || 0), 0))}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between pt-4 border-t">
                            <button
                                onClick={() => {
                                    // Navigate back to purchase list
                                    window.location.href = '/purchase';
                                }}
                                className="flex items-center px-6 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition duration-150 shadow-md"
                            >
                                <X className="w-5 h-5 mr-2" /> Close
                            </button>
                            
                            <div className="flex space-x-4">
                                <button
                                    onClick={handleSavePurchase}
                                    className="flex items-center px-6 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition duration-150 shadow-md"
                                >
                                    <Save className="w-5 h-5 mr-2" /> Save Draft
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            let tranId = purchaseData.tranid;
                                            
                                            if (!tranId) {
                                                // Save first, then proceed
                                                tranId = await handleSavePurchase();
                                            }
                                            
                                            if (tranId) {
                                                // Proceed to next step
                                                setPurchaseData(prev => ({ ...prev, status: STEPS[1].status }));
                                                setCurrentStep(2);
                                            } else {
                                                alert('Failed to save purchase. Please try again.');
                                            }
                                        } catch (error) {
                                            console.error('Error proceeding to costing:', error);
                                            alert('Error saving purchase. Please try again.');
                                        }
                                    }}
                                    disabled={purchaseData.items.length === 0 || !purchaseData.partyid}
                                    className="flex items-center px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition duration-150 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Proceed to Costing <ArrowRight className="w-5 h-5 ml-2" />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 2:
                // Calculate total overhead
                const totalOverhead = costingRows.reduce((sum, row) => sum + (parseFloat(row.Amount) || 0), 0);

                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-gray-800">2. Prepare Overhead Costing</h2>
                        <p className="text-gray-600">Allocate ancillary costs (freight, duties, etc.) to the purchase to determine the true landed cost. These costs will be capitalized.</p>

                        {/* Costing Input Section */}
                        <div className="bg-white p-6 rounded-xl shadow-md">
                            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Overhead Details (Amounts)</h3>

                            <div className="space-y-4">
                                {costingRows.map((row, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-4 py-3 border-b last:border-b-0">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={row.OHType}
                                                onChange={(e) => {
                                                    const newRows = [...costingRows];
                                                    newRows[idx] = { ...newRows[idx], OHType: e.target.value };
                                                    setCostingRows(newRows);
                                                }}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                placeholder="Cost Head"
                                            />
                                        </div>
                                        <div className="w-48">
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-500">₹</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={row.Amount || ''}
                                                    onChange={(e) => {
                                                        const newRows = [...costingRows];
                                                        newRows[idx] = { ...newRows[idx], Amount: parseFloat(e.target.value) || 0 };
                                                        setCostingRows(newRows);
                                                    }}
                                                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-right"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                    ref={
                                                        row.OHType === 'Transportation' ? tptAmtRef :
                                                            row.OHType === 'Labour' ? labAmtRef :
                                                                row.OHType === 'Misc' ? miscAmtRef : null
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (row.OHType === 'Transportation') handleCostingAmountKeyDown(e, 'tpt');
                                                        if (row.OHType === 'Labour') handleCostingAmountKeyDown(e, 'lab');
                                                        if (row.OHType === 'Misc') handleCostingAmountKeyDown(e, 'misc');
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Total Overhead */}
                                <div className="flex items-center justify-between pt-4 border-t-2 border-indigo-200">
                                    <span className="text-lg font-semibold text-gray-700">Total Overhead:</span>
                                    <span className="text-lg font-bold text-orange-500">₹{formatNumber(totalOverhead.toFixed(2))}</span>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h4 className="font-semibold text-blue-800 mb-2">Instructions:</h4>
                                <ul className="list-disc ml-5 text-sm text-blue-700 space-y-1">
                                    <li>Enter overhead amounts (Transportation, Labour, Misc).</li>
                                    <li>Click "Save Costing" to persist overheads.</li>
                                    <li>Click "Preview Allocation" to compute item-wise distribution by value.</li>
                                    <li>Click "Confirm Costing" to finalize and lock costing.</li>
                                </ul>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-3 mt-6">
                                <button
                                    ref={saveCostingBtnRef}
                                    onClick={handleSaveCosting}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save Costing'}
                                </button>

                                <button
                                    onClick={handlePreviewAllocation}
                                    disabled={totalOverhead === 0}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    Preview Allocation
                                </button>

                                <button
                                    onClick={handleConfirmCosting}
                                    disabled={isConfirming || totalOverhead === 0}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                >
                                    {isConfirming ? 'Confirming...' : 'Confirm Costing'}
                                </button>
                            </div>
                        </div>

                        {/* Preview Allocation Table */}
                        {showPreview && costingPreview.length > 0 && (
                            <div className="bg-white p-6 rounded-xl shadow-md">
                                <h3 className="text-lg font-semibold mb-4 border-b pb-2">Costing Allocation Preview</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Inv Amt</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">OH Amt</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Net Rate</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Line Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {costingPreview.map((row, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {row.itemname}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                        {formatNumber(row.qty.toFixed(2))}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                        ₹{formatNumber(row.rate.toFixed(2))}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                                                        ₹{formatNumber(row.invamount.toFixed(2))}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-orange-600 text-right">
                                                        ₹{formatNumber(row.ohamt.toFixed(2))}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-indigo-600 text-right">
                                                        ₹{formatNumber(row.netrate.toFixed(2))}
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                                        ₹{formatNumber(row.linetotal.toFixed(2))}
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Totals Row */}
                                            <tr className="bg-gray-50 font-semibold">
                                                <td className="px-3 py-3 text-sm text-gray-900">Totals</td>
                                                <td className="px-3 py-3"></td>
                                                <td className="px-3 py-3"></td>
                                                <td className="px-3 py-3 text-sm text-gray-900 text-right">
                                                    ₹{formatNumber(costingPreview.reduce((sum, row) => sum + row.invamount, 0).toFixed(2))}
                                                </td>
                                                <td className="px-3 py-3 text-sm font-bold text-orange-600 text-right">
                                                    ₹{formatNumber(costingPreview.reduce((sum, row) => sum + row.ohamt, 0).toFixed(2))}
                                                </td>
                                                <td className="px-3 py-3"></td>
                                                <td className="px-3 py-3 text-sm font-bold text-gray-900 text-right">
                                                    ₹{formatNumber(costingPreview.reduce((sum, row) => sum + row.linetotal, 0).toFixed(2))}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <InvoiceSummary invoiceData={purchaseData} />

                        <div className="flex justify-end space-x-4 pt-4 border-t">
                            <button
                                onClick={() => {
                                    setPurchaseData(prev => ({ ...prev, status: STEPS[2].status }));
                                    setCurrentStep(3);
                                }}
                                className="flex items-center px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition duration-150 shadow-lg"
                            >
                                Submit for Confirmation <ArrowRight className="w-5 h-5 ml-2" />
                            </button>
                        </div>
                    </div>
                );
            case 3:
                return <Step3Form data={purchaseData} onSave={handleSaveData} onNext={handleNextStep} />;
            case 4:
                return <Step4Form data={purchaseData} onNext={handleNextStep} />;
            default:
                return <p>Workflow complete or step error.</p>;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                    <p>Loading purchase form...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <header className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-indigo-700">Purchase Invoice Landed Cost Workflow</h1>
                    <p className="text-lg text-gray-500 mt-2">
                        {purchaseData.tranid ? (
                            <>
                                Transaction ID: <span className="font-bold text-indigo-600">#{purchaseData.tranid}</span> |
                                Invoice: {purchaseData.suppinvno || 'New Purchase'} | Status:
                                <span className={`font-semibold ml-1 ${purchaseData.status === 'Posted' ? 'text-green-600' : 'text-orange-500'
                                    }`}>
                                    {purchaseData.status}
                                </span>
                            </>
                        ) : (
                            <>
                                Invoice: {purchaseData.suppinvno || 'New Purchase'} | Status:
                                <span className={`font-semibold ml-1 ${purchaseData.status === 'Posted' ? 'text-green-600' : 'text-orange-500'
                                    }`}>
                                    {purchaseData.status}
                                </span>
                                <span className="text-sm text-gray-400 block mt-1">
                                    (Not saved yet - Click "Save Draft" to save)
                                </span>
                            </>
                        )}
                    </p>
                </header>

                <StepIndicator step={currentStep} />

                <main className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-indigo-100">
                    {renderCurrentForm()}
                </main>

                {/* Enhanced Item Selection Modal */}
                {showItemModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-lg shadow-lg w-full max-w-7xl max-h-[95vh] flex flex-col"
                        >
                            <div className="p-4 border-b flex justify-between items-center">
                                <h2 className="text-lg font-semibold">Add Item to Purchase</h2>
                                <button
                                    onClick={() => setShowItemModal(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex flex-1 overflow-hidden">
                                {/* Left Panel - Item Selection */}
                                <div className="w-1/2 border-r flex flex-col">
                                    <div className="p-4 border-b">
                                        <input
                                            type="text"
                                            placeholder="Search by Item Name (contains)"
                                            value={itemSearchTerm}
                                            onChange={(e) => { setItemSearchTerm(e.target.value); setHighlightIndex(0); }}
                                            onKeyDown={handleListKeyDown}
                                            className="w-full px-4 py-2 border rounded-lg"
                                            autoFocus
                                            ref={searchInputRef}
                                        />
                                    </div>

                                    <div className="overflow-y-auto flex-grow" ref={listRef} tabIndex={0} onKeyDown={handleListKeyDown}>
                                        <table className="w-full border-collapse">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="p-2 text-left border-b">Code</th>
                                                    <th className="p-2 text-left border-b">Name</th>
                                                    <th className="p-2 text-right border-b">Stock</th>
                                                    <th className="p-2 text-right border-b">Avg. Cost</th>
                                                    <th className="p-2 text-right border-b">S. Price</th>
                                                    <th className="p-2 text-right border-b">MRP</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredItems.length > 0 ? (
                                                    filteredItems.map((item, idx) => (
                                                        <tr
                                                            id={`item-row-${idx}`}
                                                            key={item.itemcode}
                                                            className={`hover:bg-indigo-50 cursor-pointer ${idx === highlightIndex ? 'bg-indigo-100' : ''}`}
                                                            onDoubleClick={() => selectItemInModal(item)}
                                                            onClick={() => setHighlightIndex(idx)}
                                                        >
                                                            <td className="p-2 border-b">{item.itemcode}</td>
                                                            <td className="p-2 border-b">{item.itemname}</td>
                                                            <td className="p-2 border-b text-right">{formatNumber(item.curstock || 0)}</td>
                                                            <td className="p-2 border-b text-right">{formatNumber(item.cost)}</td>
                                                            <td className="p-2 border-b text-right">{formatNumber(item.sprice || 0)}</td>
                                                            <td className="p-2 border-b text-right">{formatNumber(item.mrp || 0)}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="6" className="p-8 text-center text-gray-500">No items found</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Right Panel - Item Details & Entry */}
                                <div className="w-1/2 flex flex-col">
                                    {selectedItem ? (
                                        <>
                                            <div className="p-4 border-b space-y-4">
                                                {/* Item Name */}
                                                <div className="flex items-start gap-2">
                                                    <label className="text-sm font-medium inline-block w-20 pt-2">Item</label>
                                                    <textarea
                                                        value={selectedItem.itemname || ''}
                                                        readOnly
                                                        rows={2}
                                                        className="px-3 py-2 border rounded resize-none leading-snug -ml-[2ch] w-[calc(47ch+13rem)]"
                                                    />
                                                </div>

                                                {/* Cost, Selling Price, MRP */}
                                                <div className="grid grid-cols-3 gap-4 text-sm items-center">
                                                    <div className="flex items-center gap-2">
                                                        <label className="font-medium w-20">Cost</label>
                                                        <input type="text" value={formatNumber(selectedItem.cost ?? 0)} readOnly className="px-2 py-1 border rounded w-[15ch] text-right" />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="font-medium w-20">S.Price</label>
                                                        <input type="text" value={formatNumber(selectedItem.sprice ?? '')} readOnly className="px-2 py-1 border rounded w-[15ch] text-right" />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="font-medium w-20">MRP</label>
                                                        <input type="text" value={formatNumber(selectedItem.mrp ?? '')} readOnly className="px-2 py-1 border rounded w-[15ch] text-right" />
                                                    </div>
                                                </div>

                                                {/* GST Rates */}
                                                <div className="grid grid-cols-3 gap-4 text-sm items-center">
                                                    <div className="flex items-center gap-2">
                                                        <label className="font-medium w-20">SGST %</label>
                                                        <input
                                                            type="text"
                                                            value={formatNumber(modalItemData.SGSTPer)}
                                                            onChange={(e) => calculateModalTotals(selectedItem, modalItemData.Qty, modalItemData.Rate, modalItemData.CGSTPer, parseNumber(e.target.value), modalItemData.IGSTPer)}
                                                            className="px-2 py-1 border rounded w-[15ch] text-right"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="font-medium w-20">CGST %</label>
                                                        <input
                                                            type="text"
                                                            value={formatNumber(modalItemData.CGSTPer)}
                                                            onChange={(e) => calculateModalTotals(selectedItem, modalItemData.Qty, modalItemData.Rate, parseNumber(e.target.value), modalItemData.SGSTPer, modalItemData.IGSTPer)}
                                                            className="px-2 py-1 border rounded w-[15ch] text-right"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="font-medium w-20">IGST %</label>
                                                        <input
                                                            type="text"
                                                            value={formatNumber(modalItemData.IGSTPer)}
                                                            onChange={(e) => calculateModalTotals(selectedItem, modalItemData.Qty, modalItemData.Rate, modalItemData.CGSTPer, modalItemData.SGSTPer, parseNumber(e.target.value))}
                                                            className="px-2 py-1 border rounded w-[15ch] text-right"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 flex-grow">
                                                <h3 className="font-semibold text-lg mb-4">Enter Quantity & Rate</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-sm font-medium w-24">Quantity</label>
                                                        <input
                                                            ref={qtyInputRef}
                                                            type="number"

                                                            step="0.01"
                                                            inputMode="decimal"
                                                            value={modalItemData.Qty}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                const num = val === '' ? 0 : parseFloat(val);
                                                                calculateModalTotals(
                                                                    selectedItem,
                                                                    isNaN(num) ? 0 : num,
                                                                    modalItemData.Rate,
                                                                    modalItemData.CGSTPer,
                                                                    modalItemData.SGSTPer,
                                                                    modalItemData.IGSTPer
                                                                );
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === 'Tab') {
                                                                    e.preventDefault();
                                                                    if (rateInputRef.current) {
                                                                        rateInputRef.current.focus();
                                                                        rateInputRef.current.select();
                                                                    }
                                                                }
                                                            }}
                                                            className="flex-1 px-3 py-2 border rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-sm font-medium w-24">Rate</label>
                                                        <input
                                                            ref={rateInputRef}
                                                            type="number"
                                                            step="0.01"
                                                            inputMode="decimal"
                                                            value={modalItemData.Rate}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                const num = val === '' ? 0 : parseFloat(val);
                                                                calculateModalTotals(
                                                                    selectedItem,
                                                                    modalItemData.Qty,
                                                                    isNaN(num) ? 0 : num,
                                                                    modalItemData.CGSTPer,
                                                                    modalItemData.SGSTPer,
                                                                    modalItemData.IGSTPer
                                                                );
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === 'Tab') {
                                                                    e.preventDefault();
                                                                    if (saveAddNewRef.current) {
                                                                        saveAddNewRef.current.focus();
                                                                    }
                                                                }
                                                            }}
                                                            className="flex-1 px-3 py-2 border rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mt-6 p-4 bg-gray-50 rounded">
                                                    <h4 className="font-semibold mb-3">Calculated Values</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span>Taxable Value:</span>
                                                            <span className="font-medium">₹{formatNumber(modalItemData.InvAmount.toFixed(2))}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>CGST Amount ({modalItemData.CGSTPer}%):</span>
                                                            <span className="font-medium">₹{formatNumber(modalItemData.CGSTAmount.toFixed(2))}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>SGST Amount ({modalItemData.SGSTPer}%):</span>
                                                            <span className="font-medium">₹{formatNumber(modalItemData.SGSTAmount.toFixed(2))}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>IGST Amount ({modalItemData.IGSTPer}%):</span>
                                                            <span className="font-medium">₹{formatNumber(modalItemData.IGSTAmount.toFixed(2))}</span>
                                                        </div>
                                                        <div className="flex justify-between border-t pt-2 font-semibold text-base">
                                                            <span>Total Value:</span>
                                                            <span>₹{formatNumber(modalItemData.GTotal.toFixed(2))}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex-grow flex items-center justify-center text-gray-500">
                                            <div className="text-center">
                                                <p className="text-lg">Select an item from the list</p>
                                                <p className="text-sm">to enter quantity and rate</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t flex justify-end gap-2">
                                <button
                                    onClick={() => setShowItemModal(false)}
                                    className="px-4 py-2 border rounded-lg"
                                >
                                    Cancel
                                </button>
                                {selectedItem && (
                                    <>
                                        <button
                                            ref={saveAddNewRef}
                                            onClick={addItemAndContinue}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                        >
                                            Save & Add New
                                        </button>
                                        <button
                                            onClick={addItemToForm}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                        >
                                            Save & Close
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}