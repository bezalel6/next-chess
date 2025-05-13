import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
    getGameService,
    getMatchmakingService,
    enableSecureServices,
    disableSecureServices,
    logServiceConfiguration
} from '@/utils/serviceTransition';

// Types for our context
interface ServiceContextType {
    isUsingSecureServices: boolean;
    gameService: any;
    matchmakingService: any;
    enableSecureServices: () => void;
    disableSecureServices: () => void;
}

// Create the context
const ServiceContext = createContext<ServiceContextType | null>(null);

interface ServiceProviderProps {
    children: ReactNode;
    defaultSecure?: boolean;
}

// Helper function to create service wrappers that delegate to the static methods
const createServiceWrapper = (ServiceClass: any) => {
    // Return an object with methods that delegate to the static methods
    return Object.getOwnPropertyNames(ServiceClass)
        .filter(prop => typeof ServiceClass[prop] === 'function' && prop !== 'constructor')
        .reduce((wrapper, methodName) => {
            wrapper[methodName] = (...args: any[]) => ServiceClass[methodName](...args);
            return wrapper;
        }, {} as Record<string, any>);
};

/**
 * Provider component that wraps the app and provides service references
 */
export function ServiceProvider({
    children,
    defaultSecure = true
}: ServiceProviderProps) {
    const [isUsingSecureServices, setIsUsingSecureServices] = useState(defaultSecure);
    const [gameService, setGameService] = useState(() => createServiceWrapper(getGameService()));
    const [matchmakingService, setMatchmakingService] = useState(() => createServiceWrapper(getMatchmakingService()));

    // Toggle secure services on/off
    const toggleSecureServicesOn = () => {
        enableSecureServices();
        setGameService(createServiceWrapper(getGameService()));
        setMatchmakingService(createServiceWrapper(getMatchmakingService()));
        setIsUsingSecureServices(true);
        logServiceConfiguration();
    };

    const toggleSecureServicesOff = () => {
        disableSecureServices();
        setGameService(createServiceWrapper(getGameService()));
        setMatchmakingService(createServiceWrapper(getMatchmakingService()));
        setIsUsingSecureServices(false);
        logServiceConfiguration();
    };

    // Initialize services based on default setting
    useEffect(() => {
        if (defaultSecure) {
            enableSecureServices();
        } else {
            disableSecureServices();
        }
        setGameService(createServiceWrapper(getGameService()));
        setMatchmakingService(createServiceWrapper(getMatchmakingService()));
        logServiceConfiguration();
    }, [defaultSecure]);

    const value = {
        isUsingSecureServices,
        gameService,
        matchmakingService,
        enableSecureServices: toggleSecureServicesOn,
        disableSecureServices: toggleSecureServicesOff,
    };

    return (
        <ServiceContext.Provider value={value}>
            {children}
        </ServiceContext.Provider>
    );
}

/**
 * Hook to use the service context
 */
export function useServices() {
    const context = useContext(ServiceContext);
    if (!context) {
        throw new Error('useServices must be used within a ServiceProvider');
    }
    return context;
} 