import React, { createContext, useContext, useState } from 'react';

const ModalContext = createContext();

export const ModalProvider = ({ children }) => {
    const [modals, setModals] = useState({
        addProduct: false,
        editProduct: false,
        viewProduct: false,
        cart: false,
        receipt: false,
        editSale: false,
        export: false,
        shift: false,
        auth: false,
        mobileMenu: false,
    });

    const [activeData, setActiveData] = useState({
        product: null,
        sale: null,
        authAction: { callback: null, title: "", message: "" },
        prefilledProduct: null,
    });

    const timeoutsRef = React.useRef({});

    const openModal = (name, data = null) => {
        if (timeoutsRef.current[name]) {
            clearTimeout(timeoutsRef.current[name]);
            delete timeoutsRef.current[name];
        }

        if (data) {
            if (name === 'editProduct' || name === 'viewProduct') setActiveData(prev => ({ ...prev, product: data }));
            if (name === 'editSale' || name === 'receipt') setActiveData(prev => ({ ...prev, sale: data }));
            if (name === 'auth') setActiveData(prev => ({ ...prev, authAction: data }));
            if (name === 'addProduct') setActiveData(prev => ({ ...prev, prefilledProduct: data }));
        }
        setModals(prev => ({ ...prev, [name]: true }));
    };

    const closeModal = (name) => {
        setModals(prev => ({ ...prev, [name]: false }));
        // Optionally clear data after delay to avoid flicker
        if (['editProduct', 'viewProduct', 'editSale', 'receipt', 'auth', 'addProduct'].includes(name)) {
            if (timeoutsRef.current[name]) {
                clearTimeout(timeoutsRef.current[name]);
            }
            timeoutsRef.current[name] = setTimeout(() => {
                setActiveData(prev => ({
                    ...prev,
                    [name === 'addProduct' ? 'prefilledProduct' : (name.includes('Product') ? 'product' : (name.includes('Sale') || name === 'receipt' ? 'sale' : 'authAction'))]: null
                }));
                delete timeoutsRef.current[name];
            }, 300);
        }
    };

    return (
        <ModalContext.Provider value={{ modals, activeData, openModal, closeModal }}>
            {children}
        </ModalContext.Provider>
    );
};

export const useModals = () => {
    const context = useContext(ModalContext);
    if (!context) throw new Error('useModals must be used within ModalProvider');
    return context;
};
