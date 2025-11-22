export const prescriptionOrderFixtures = {
  turkish: {
    patientName: 'Ahmet Yılmaz',
    patientEmail: 'ahmet.yilmaz@example.com.tr',
    nhsNumber: 'TR-123-456-7890',
    pharmacyId: 'PHARM-TR-001',
    country: 'TR',
    medications: [
      {
        medicationName: 'Aspirin',
        dosage: '100mg',
        quantity: '30 tablets',
      },
    ],
    deliveryMethod: 'collection',
    notes: 'Turkish data residency test',
  },

  us: {
    patientName: 'John Smith',
    patientEmail: 'john.smith@example.com',
    nhsNumber: 'US-123-456-7890',
    pharmacyId: 'PHARM-US-001',
    country: 'US',
    medications: [
      {
        medicationName: 'Lisinopril',
        dosage: '10mg',
        quantity: '30 tablets',
      },
    ],
    deliveryMethod: 'delivery',
    deliveryAddress: '123 Main St, New York, NY 10001',
  },

  standard: {
    patientName: 'Bob Johnson',
    patientEmail: 'bob.johnson@example.com',
    nhsNumber: '123-456-7890',
    pharmacyId: 'PHARM-001',
    medications: [
      {
        medicationName: 'Paracetamol',
        dosage: '500mg',
        quantity: '20 tablets',
      },
    ],
    deliveryMethod: 'collection',
  },
};
