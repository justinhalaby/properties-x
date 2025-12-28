// Test script to simulate bookmarklet data extraction
// Run this in the browser console on a Quebec company page

const testData = {
  neq: "1174086139", // Example NEQ
  identification: {
    name: "TEST COMPANY INC.",
    status: "Immatriculée",
    domicile_address: "123 rue Test, Montréal, Québec, H2Y 1V9",
    registration_date: "2024-01-01",
    status_date: "2024-01-01"
  },
  shareholders: [
    {
      name: "John Doe",
      address: "456 rue Example, Montréal, Québec, H3A 1A1",
      is_majority: true,
      position: 1
    }
  ],
  administrators: [
    {
      name: "Jane Smith",
      position_title: "Présidente",
      domicile_address: "",
      professional_address: "789 av Business, Montréal, Québec, H4B 2B2",
      position_order: 1
    }
  ],
  economic_activity: {
    cae_code: "531210",
    cae_description: "Bureaux d'agents et de courtiers immobiliers"
  },
  source_url: window.location.href
};

// Send to API
fetch('http://localhost:3000/api/companies/bookmarklet', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Bookmarklet-Key': 'qc_bookmarklet_2024_secure_key_$2y$10$abc123xyz'
  },
  body: JSON.stringify(testData)
})
.then(res => res.json())
.then(data => {
  console.log('Success:', data);
  if (data.success) {
    console.log('Company ID:', data.companyId);
    console.log('View at: http://localhost:3000/companies/' + data.companyId);
  }
})
.catch(error => console.error('Error:', error));
