
import { TransportJob, User } from "../types";

// --- MOCK DRIVERS DB (Localized for Odisha Hackathon) ---
const MOCK_DRIVERS: User[] = [
    {
        id: 'driver_1',
        farmer_id: 'DRV-001',
        name: 'Ramesh Das',
        email: 'ramesh.logistics@odisha.com',
        phone: '+91 98765 88888',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=RameshDas',
        role: 'driver',
        driver_details: {
            vehicleType: 'Mini Truck',
            vehicleNumber: 'OD-02-AB-1234',
            licenseNumber: 'DL-OD02-998877',
            loadCapacity: 20, // Quintals
            isVerified: true,
            rating: 4.8,
            totalTrips: 150,
            earnings: { total: 125000, thisMonth: 12500, lastMonth: 11000, pendingPayout: 2500 }
        },
        location: { lat: 20.2961, lon: 85.8245, district: 'Bhubaneswar' }, // BHU
        usage: { scans_this_month: 0, last_reset_date: 0 }
    },
    {
        id: 'driver_2',
        farmer_id: 'DRV-002',
        name: 'Suresh Behera',
        email: 'suresh@farm.com',
        phone: '+91 98765 99999',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Suresh',
        role: 'driver',
        driver_details: {
            vehicleType: 'Tractor',
            vehicleNumber: 'OD-05-TR-5555',
            licenseNumber: 'DL-OD05-112233',
            loadCapacity: 40,
            isVerified: true,
            rating: 4.5,
            totalTrips: 45,
            earnings: { total: 45000, thisMonth: 5000, lastMonth: 4000, pendingPayout: 1000 }
        },
        location: { lat: 20.4625, lon: 85.8828, district: 'Cuttack' }, // CTC
        usage: { scans_this_month: 0, last_reset_date: 0 }
    },
    {
        id: 'driver_3',
        farmer_id: 'DRV-003',
        name: 'Bijay Logistics',
        email: 'bijay@lorry.com',
        phone: '+91 98765 77777',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bijay',
        role: 'driver',
        driver_details: {
            vehicleType: 'Lorry',
            vehicleNumber: 'OD-33-BL-9090',
            licenseNumber: 'DL-OD33-445566',
            loadCapacity: 100, // 10 Tons
            isVerified: true,
            rating: 4.2,
            totalTrips: 300,
            earnings: { total: 500000, thisMonth: 40000, lastMonth: 35000, pendingPayout: 5000 }
        },
        location: { lat: 20.175, lon: 85.706, district: 'Jatni' }, // Jatni
        usage: { scans_this_month: 0, last_reset_date: 0 }
    },
    {
        id: 'driver_4',
        farmer_id: 'DRV-004',
        name: 'Amit Mohanty',
        email: 'amit@pickup.com',
        phone: '+91 98765 66666',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amit',
        role: 'driver',
        driver_details: {
            vehicleType: 'Pickup',
            vehicleNumber: 'OD-07-P-1122',
            licenseNumber: 'DL-OD07-778899',
            loadCapacity: 10, // 1 Ton
            isVerified: true,
            rating: 4.9,
            totalTrips: 80,
            earnings: { total: 60000, thisMonth: 8000, lastMonth: 7000, pendingPayout: 1500 }
        },
        location: { lat: 19.813, lon: 85.831, district: 'Puri' }, // Puri
        usage: { scans_this_month: 0, last_reset_date: 0 }
    },
    {
        id: 'driver_5',
        farmer_id: 'DRV-005',
        name: 'Balram Singh',
        email: 'balram@tractor.com',
        phone: '+91 98765 55555',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Balram',
        role: 'driver',
        driver_details: {
            vehicleType: 'Tractor',
            vehicleNumber: 'OD-02-AT-8811',
            licenseNumber: 'DL-OD02-223344',
            loadCapacity: 35,
            isVerified: true,
            rating: 4.6,
            totalTrips: 62,
            earnings: { total: 55000, thisMonth: 6000, lastMonth: 4500, pendingPayout: 1200 }
        },
        location: { lat: 20.296, lon: 85.824, district: 'Bhubaneswar' },
        usage: { scans_this_month: 0, last_reset_date: 0 }
    }
];

// --- MOCK JOBS DB ---
let MOCK_JOBS: TransportJob[] = [
    { id: 'TR-1001', farmerId: 'u1', farmerName: 'Ramesh K.', crop: 'Wheat', weight: 50, pickupLocation: 'Village A', dropLocation: 'Mandi B', distanceKm: 12, vehicleType: 'Mini Truck', status: 'Open', offeredPrice: 1200, createdAt: Date.now() - 3600000, farmerPhone: '+91 99999 11111' },
    { id: 'TR-1002', farmerId: 'u2', farmerName: 'Sita D.', crop: 'Rice', weight: 100, pickupLocation: 'Farm X', dropLocation: 'Warehouse Y', distanceKm: 25, vehicleType: 'Lorry', status: 'Open', offeredPrice: 2500, createdAt: Date.now() - 7200000, farmerPhone: '+91 88888 22222' }
];

export const calculateFairPrice = (distanceKm: number, weightQuintals: number, vehicleType: string): { min: number, max: number, reason: string } => {
    // Base Rates
    let baseRatePerKm = 0;
    let loadingCharge = 200;
    
    switch(vehicleType) {
        case 'Tractor': baseRatePerKm = 35; break;
        case 'Mini Truck': baseRatePerKm = 45; break;
        case 'Lorry': baseRatePerKm = 60; break;
        case 'Pickup': baseRatePerKm = 25; break;
        default: baseRatePerKm = 30;
    }

    // Weight penalty if overloaded (simple logic)
    const weightFactor = Math.max(1, weightQuintals / 10); 
    
    const estimatedCost = (distanceKm * baseRatePerKm) + (loadingCharge * weightFactor);
    const variance = estimatedCost * 0.15; // +/- 15%

    return {
        min: Math.round(estimatedCost - variance),
        max: Math.round(estimatedCost + variance),
        reason: `Based on ${distanceKm}km distance and current fuel rates for ${vehicleType}.`
    };
};

export const getVehicleForWeight = (weightQtl: number): string => {
    if (weightQtl <= 15) return 'Pickup';
    if (weightQtl <= 30) return 'Mini Truck';
    if (weightQtl <= 60) return 'Tractor';
    return 'Lorry';
};

export const verifyIdentityWithSurePass = async (docType: string, docNumber: string) => {
    // Simulation of API call to SurePass for KYC
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`Verifying ${docType}: ${docNumber}`);
    
    // Random mock validation (always true for demo unless empty)
    if (!docNumber) return { success: false, error: 'Invalid ID' };
    
    return { 
        success: true, 
        details: { 
            name: "Verified User", 
            age: 30, 
            address: "Nagpur, Maharashtra" 
        } 
    };
};

export const createTransportRequest = async (request: any) => {
    const newJob: TransportJob = {
        id: `TR-${Date.now()}`,
        farmerId: request.farmerId,
        farmerName: request.farmerName,
        crop: request.crop,
        weight: parseFloat(request.weight),
        pickupLocation: request.pickupLocation,
        dropLocation: request.dropLocation,
        distanceKm: Math.floor(Math.random() * 50) + 10, // Mock distance
        vehicleType: request.vehicleType,
        status: 'Open',
        offeredPrice: request.offeredPrice,
        createdAt: Date.now(),
        farmerPhone: request.farmerPhone,
        negotiationStatus: 'None'
    };
    
    MOCK_JOBS.unshift(newJob);
    return newJob;
};

export const findNearbyDrivers = async (lat: number, lon: number): Promise<User[]> => {
    // Mock spatial query - In real app use PostGIS
    // Returns all mock drivers for simulation
    return MOCK_DRIVERS;
};

export const getAvailableJobs = async (driverLocation?: any): Promise<TransportJob[]> => {
    return MOCK_JOBS.filter(j => j.status === 'Open');
};

export const getMyDriverTrips = async (driverId: string): Promise<TransportJob[]> => {
    if (MOCK_JOBS.filter(j => j.driverId === driverId).length === 0) {
        return [
            { id: 'TR-2201', farmerId: 'u1', farmerName: 'Ramesh K.', crop: 'Wheat', weight: 10, pickupLocation: 'Village A', dropLocation: 'Mandi B', distanceKm: 12, vehicleType: 'Mini Truck', status: 'Completed', offeredPrice: 1200, driverId, createdAt: Date.now() - 86400000, farmerPhone: '+91 99999 11111' },
            { id: 'TR-2198', farmerId: 'u2', farmerName: 'Sita D.', crop: 'Rice', weight: 15, pickupLocation: 'Farm X', dropLocation: 'Warehouse Y', distanceKm: 20, vehicleType: 'Tractor', status: 'Completed', offeredPrice: 1500, driverId, createdAt: Date.now() - 172800000, farmerPhone: '+91 88888 22222' }
        ];
    }
    return MOCK_JOBS.filter(j => j.driverId === driverId);
};

export const getDriverStats = async (driverId: string) => {
    return {
        totalEarnings: 1250.00,
        completedTrips: 12,
        activeTrips: 0,
        rating: 4.8
    };
};

export const acceptJob = async (jobId: string, driverId: string): Promise<boolean> => {
    const job = MOCK_JOBS.find(j => j.id === jobId);
    if (job) {
        job.status = 'Accepted';
        job.driverId = driverId;
        return true;
    }
    return false;
};

export const updateJobStatus = async (jobId: string, status: TransportJob['status']): Promise<boolean> => {
    const job = MOCK_JOBS.find(j => j.id === jobId);
    if (job) {
        job.status = status;
        return true;
    }
    return false;
};

export const negotiateJob = async (jobId: string, counterOffer: number): Promise<'Accepted' | 'Rejected'> => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const job = MOCK_JOBS.find(j => j.id === jobId);
    if (!job) return 'Rejected';
    if (counterOffer <= job.offeredPrice * 1.15) {
        job.offeredPrice = counterOffer;
        job.negotiationStatus = 'Accepted';
        return 'Accepted';
    } else {
        job.negotiationStatus = 'Rejected';
        return 'Rejected';
    }
};

export const registerDriver = async (data: any): Promise<User> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
        id: `driver_${Date.now()}`,
        farmer_id: `DRV-${Math.floor(Math.random()*1000)}`,
        name: data.name,
        email: data.email,
        phone: data.phone,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`,
        role: 'driver',
        driver_details: {
            vehicleType: data.vehicleType,
            vehicleNumber: '', 
            licenseNumber: '', 
            loadCapacity: 0, 
            isVerified: false, 
            rating: 0,
            totalTrips: 0
        },
        usage: { scans_this_month: 0, last_reset_date: 0 }
    };
};
