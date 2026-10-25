async function run() {
  try {
    // 1. Login
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rohit@meil-esg.in', password: 'esg12345' }),
    });
    console.log('Login status:', loginRes.status);
    const loginData = await loginRes.json();
    console.log('Login response payload:', loginData);

    const cookieHeader = loginRes.headers.get('set-cookie');
    console.log('Got cookie:', cookieHeader);

    // 2. Fetch session / overview
    const ovRes = await fetch('http://localhost:3000/api/overview', {
      headers: { cookie: cookieHeader || '' },
    });
    const ovData = await ovRes.json();
    console.log('Overview response payload:', ovData);

    const projectId = ovData.project?.id;
    const periodId = ovData.reportingPeriod?.id;

    if (!projectId || !periodId) {
      console.log('Could not get project or period');
      return;
    }

    // 3. Post Level 3 GHG record
    const ghgPayload = {
      level: 3,
      levelKey: 'level3',
      levelName: 'Level 3 — GHG Emissions & Air Quality',
      module: 'EMISSIONS',
      projectId,
      reportingPeriodId: periodId,
      data: {
        items: [
          {
            id: 'item-fuel-diesel',
            sourceCategory: 'fuel_combustion',
            emissionDataType: 'Scope 1 activity',
            emissionSource: 'DG Sets & Power Generators',
            fuelEnergyType: 'Diesel (HSD)',
            equipmentId: 'MEIL-DG-002',
            activityQuantity: '18650',
            unit: 'litres',
            reportingPeriod: 'June 2026',
            factor: 2.637,
            factorUnit: 'kgCO2e/L',
            factorSource: 'IPCC Guidelines 2006 Vol 2 Ch 2',
            factorVersion: 1,
            factorConfigured: true,
            calculationFormula: '18,650 litres × 2.637 kgCO2e/L ÷ 1,000 = 49.180 tCO₂e',
            calculationTimestamp: new Date().toISOString(),
            estTco2e: 49.18,
            supportingEvidence: 'SAP Fuel Procurement Ledger & DG Run Logbook',
            remarks: 'Scope 1 direct diesel combustion for backup generation.',
          },
          {
            id: 'item-elec-grid',
            sourceCategory: 'electricity_grid',
            emissionDataType: 'Scope 2 activity',
            emissionSource: 'Purchased Grid Electricity (Scope 2)',
            fuelEnergyType: 'Grid Electricity (India)',
            equipmentId: 'MTR-GJT-GRID-01',
            electricityKwh: '384000',
            activityQuantity: '384000',
            unit: 'kWh',
            reportingPeriod: 'June 2026',
            factor: 0.716,
            factorUnit: 'kgCO2e/kWh',
            factorSource: 'CEA CO2 Baseline Database v19',
            factorVersion: 1,
            factorConfigured: true,
            calculationFormula: '384,000 kWh × 0.716 kgCO2e/kWh ÷ 1,000 = 274.944 tCO₂e',
            calculationTimestamp: new Date().toISOString(),
            estTco2e: 274.944,
            supportingEvidence: 'Monthly Utility Tariff Invoice & AMR Meter Log',
            remarks: 'Scope 2 indirect purchased electricity for 33kV substation.',
          },
          {
            id: 'item-freight-c4',
            sourceCategory: 'freight_logistics',
            emissionDataType: 'Scope 3 activity',
            scope3Category: 'C4 Upstream Transportation and Distribution',
            scope3Applicable: true,
            emissionSource: 'Value Chain & Freight Logistics (Scope 3)',
            cargoWeightTonnes: '500',
            transportMode: 'Heavy Duty Road Truck (Diesel)',
            distanceKm: '850',
            tonneKm: '425000',
            activityQuantity: '425000',
            unit: 'tonne-km',
            reportingPeriod: 'June 2026',
            factor: 0.114,
            factorUnit: 'kgCO2e/tonne-km',
            factorSource: 'Smart Freight Centre GLEC Framework v3.0',
            factorVersion: 1,
            factorConfigured: true,
            calculationFormula: '425,000 tonne-km × 0.114 kgCO2e/tonne-km ÷ 1,000 = 48.450 tCO₂e',
            calculationTimestamp: new Date().toISOString(),
            estTco2e: 48.45,
            supportingEvidence: 'Consolidated E-Way Bills & Freight Invoices #FWD-9910',
            remarks: 'Scope 3 Category C4 upstream freight logistics.',
          },
          {
            id: 'item-air-mon',
            sourceCategory: 'air_monitoring',
            emissionDataType: 'Air pollutant',
            emissionSource: 'Ambient Air Monitoring',
            pollutantType: 'PM10 / PM2.5',
            unit: 'µg/m³',
            samplingLocation: 'Perimeter Air Monitoring Station 01',
            testDate: '2026-06-15',
            laboratory: 'Vimta Labs Ltd. (NABL / CPCB Recognized)',
            testMethod: 'IS 5182 (Part 23) High Volume Gravimetric',
            measuredResult: '48.2',
            testResult: '48.2 µg/m³',
            regulatoryBenchmark: 'NAAQS 24-hr limit: 100 µg/m³ for PM10',
            complianceStatus: 'COMPLIANT',
            activityQuantity: '48.2',
            reportingPeriod: 'June 2026',
            factor: 0,
            factorUnit: 'µg/m³',
            factorConfigured: true,
            calculationFormula: 'Ambient concentration monitored per NAAQS 2009 (Not mixed with GHG CO2e)',
            calculationTimestamp: new Date().toISOString(),
            estTco2e: 0,
            supportingEvidence: 'NABL Certified Ambient Air Quality Report',
            remarks: 'Monitored at site boundary. Compliance with CPCB NAAQS 2009 confirmed.',
          }
        ],
        status: 'Draft',
      },
      submitForReview: false,
    };

    const dataEntryRes = await fetch('http://localhost:3000/api/data-entry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader || '',
      },
      body: JSON.stringify(ghgPayload),
    });
    console.log('Data entry save status:', dataEntryRes.status);
    const dataEntryResult = await dataEntryRes.json();
    console.log('Save result success:', dataEntryResult.success);
    console.log('Saved record ID:', dataEntryResult.record?.id);
    console.log('Saved calculations:', dataEntryResult.record?.calculations);

    // 4. Test GET /api/data-entry for Level 3
    const getRes = await fetch(`http://localhost:3000/api/data-entry?projectId=${projectId}&periodId=${periodId}&level=3`, {
      headers: { cookie: cookieHeader || '' },
    });
    const getData = await getRes.json();
    console.log('GET /api/data-entry status:', getRes.status);
    console.log('Records returned count:', getData.records?.length);
    if (getData.records?.[0]) {
      const rec = getData.records[0];
      console.log('First record status:', rec.status);
      console.log('First record calculation totalTco2e:', rec.calculations?.totalTco2e);
      console.log('First record calculation s1Tco2e:', rec.calculations?.s1Tco2e);
      console.log('First record calculation s2Tco2e:', rec.calculations?.s2Tco2e);
      console.log('First record calculation s3Tco2e:', rec.calculations?.s3Tco2e);
      console.log('First record calculation airCount (Strictly separated):', rec.calculations?.airCount);
      console.log('First record calculation lineage factor version:', rec.calculations?.lineage?.[0]?.factorVersion);
    }
  } catch (err) {
    console.error('Error running test:', err);
  }
}

run();
