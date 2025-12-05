import React, { useState, useEffect, useRef } from 'react';
import './RealEstateFinApp.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function RealEstateFinApp() {
  const [price, setPrice] = useState(5000000);
  const [dpPercent, setDpPercent] = useState(20);
  const [dpAmount, setDpAmount] = useState(1000000);
  const [reservation, setReservation] = useState(50000);
  const [dpMonths, setDpMonths] = useState(12);
  const [financing, setFinancing] = useState('Bank Financing');
  const [loanTerm, setLoanTerm] = useState(5);
  const [interest, setInterest] = useState(7.5);
  const [projectName, setProjectName] = useState('');
  const [houseModel, setHouseModel] = useState('');
  const [lotArea, setLotArea] = useState('');
  const [lotType, setLotType] = useState('Inner Lot');
  const [constructionStatus, setConstructionStatus] = useState('Pre-Selling');
  const [dateGenerated, setDateGenerated] = useState('');
  const [dateGeneratedFile, setDateGeneratedFile] = useState('');
  const [generationNumber, setGenerationNumber] = useState(0);
  // Load persisted generation number from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('computeMeGeneration');
      if (saved) setGenerationNumber(Number(saved));
    } catch (e) {
      // ignore storage errors
    }
  }, []);
  const [loanTerms, setLoanTerms] = useState([]);
  const [computationData, setComputationData] = useState(null);
  const simpleTableRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString();
    return `${dateStr} ${timeStr}`;
  });
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  const financingOptions = {
    'Bank Financing': {
      incomeRatio: 0.35,
      terms: [5, 10, 15, 20],
      defaultRate: 7.5,
    },
    'Pag-IBIG Financing': {
      incomeRatio: 0.3,
      terms: [5, 10, 15, 20, 25, 30],
      defaultRate: 6.25,
    },
  };

  // Populate loan terms when financing changes
  useEffect(() => {
    const preset = financingOptions[financing];
    setLoanTerms(preset.terms);
    setLoanTerm(preset.terms[0]);
    setInterest(preset.defaultRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financing]);

  // Update clock every second for the Data Entry card (include date and time)
  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      const timeStr = now.toLocaleTimeString();
      setCurrentTime(`${dateStr} ${timeStr}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Note: automatic recompute removed — computation runs only when user clicks "Okay"

  const fmtCurrency = (n) => {
    if (!isFinite(n)) return '₱0.00';
    return (
      '₱' +
      Number(n).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const fmtCurrencyRounded = (n) => {
    if (!isFinite(n)) return '₱0.00';
    return (
      '₱' +
      Math.ceil(n).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const amortMonthly = (p, annualRate, years) => {
    const n = years * 12;
    if (n === 0) return 0;
    if (!annualRate) return p / n;
    const m = annualRate / 12;
    const denom = Math.pow(1 + m, n) - 1;
    if (denom === 0) return p / n;
    return (p * (m * Math.pow(1 + m, n))) / denom;
  };

  const compute = () => {
    // Determine down payment based on financing type
    let dpBase;
    if (financing === 'Bank Financing') {
      dpBase = price * (dpPercent / 100);
    } else {
      dpBase = dpAmount;
    }

    const dpFinal = Math.max(0, dpBase - reservation);
    const loanAmount = Math.max(0, price - dpBase);

    const annualRate = interest / 100;
    const monthlyDP = dpFinal / dpMonths;

    const allTerms = financingOptions[financing].terms;
    let idx = allTerms.indexOf(loanTerm);
    if (idx === -1) idx = allTerms.length - 1;
    const start = Math.max(0, idx - 2);
    const pickedSlice = allTerms.slice(start, idx + 1);
    const picked = pickedSlice.slice().reverse();

    const incomeRatio = financingOptions[financing].incomeRatio || 0.35;

    const amortizationData = picked.map((y) => {
      const monthly = amortMonthly(loanAmount, annualRate, y);
      const requiredIncome = incomeRatio > 0 ? monthly / incomeRatio : 0;
      return {
        term: y,
        monthly,
        requiredIncome,
      };
    });

    setComputationData({
      price,
      dpBase,
      dpFinal,
      dpMonths,
      monthlyDP,
      loanAmount,
      amortizationData,
    });
  };

  function handleOkay() {
    // set date generated to current system time and compute
    const now = new Date();
    const display = now.toLocaleString();
    const fileStamp = formatDateForFilename(now);
    const gen = (generationNumber || 0) + 1;
    setDateGenerated(display);
    setDateGeneratedFile(fileStamp);
    setGenerationNumber(gen);
    try { localStorage.setItem('computeMeGeneration', String(gen)); } catch (e) {}
    compute();
  }

  function handleReset() {
    // reset to sensible defaults
    setPrice(5000000);
    setDpPercent(20);
    setDpAmount(1000000);
    setReservation(50000);
    setDpMonths(12);
    setFinancing('Bank Financing');
    setLoanTerm(5);
    setInterest(financingOptions['Bank Financing'].defaultRate || 7.5);
    setProjectName('');
    setHouseModel('');
    setLotArea('');
    setLotType('Inner Lot');
    setConstructionStatus('Pre-Selling');
    setDateGenerated('');
    setDateGeneratedFile('');
    setGenerationNumber(0);
    try { localStorage.removeItem('computeMeGeneration'); } catch (e) {}
    setComputationData(null);
  }

  const handleSaveJpeg = async () => {
    if (generationNumber <= 0) return; // exports disabled until after first Okay
    if (simpleTableRef.current) {
      const el = simpleTableRef.current;
      // Clone the element so we can render its full size offscreen without affecting layout
      const clone = el.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      // set explicit size to include scrollable content
      clone.style.width = el.scrollWidth + 'px';
      clone.style.height = el.scrollHeight + 'px';
      clone.style.overflow = 'visible';
      document.body.appendChild(clone);
      try {
        const scale = Math.min(2, window.devicePixelRatio || 1.5);
        const canvas = await html2canvas(clone, {
          scale,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: clone.scrollWidth,
          height: clone.scrollHeight,
          windowWidth: clone.scrollWidth,
          windowHeight: clone.scrollHeight,
          scrollX: 0,
          scrollY: 0,
        });
        const link = document.createElement('a');
        const gen = generationNumber || 1;
        const fileDate = dateGeneratedFile || formatDateForFilename(new Date());
        const finLabel = sanitizeFinancing(financing);
        const fileName = `Sample Computation - ${finLabel} - ${fileDate} - ${gen}.jpg`;
        link.download = fileName;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
      } finally {
        // clean up the clone
        document.body.removeChild(clone);
      }
    }
  };

  const handleSavePdf = async () => {
    if (generationNumber <= 0) return; // exports disabled until after first Okay
    if (simpleTableRef.current) {
      const el = simpleTableRef.current;
      const clone = el.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.width = el.scrollWidth + 'px';
      clone.style.height = el.scrollHeight + 'px';
      clone.style.overflow = 'visible';
      document.body.appendChild(clone);
      try {
        const scale = Math.min(2, window.devicePixelRatio || 1.5);
        const canvas = await html2canvas(clone, {
          scale,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: clone.scrollWidth,
          height: clone.scrollHeight,
          windowWidth: clone.scrollWidth,
          windowHeight: clone.scrollHeight,
          scrollX: 0,
          scrollY: 0,
        });
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdfDoc = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: 'a4',
      });
      const pageWidth = pdfDoc.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 40;
      const ratio = canvas.height / canvas.width;
      const imgHeight = imgWidth * ratio;
      pdfDoc.addImage(imgData, 'JPEG', 20, 20, imgWidth, imgHeight);
      const gen = generationNumber || 1;
      const fileDate = dateGeneratedFile || formatDateForFilename(new Date());
      const finLabel = sanitizeFinancing(financing);
      const fileName = `Sample Computation - ${finLabel} - ${fileDate} - ${gen}.pdf`;
      pdfDoc.save(fileName);
      } finally {
        document.body.removeChild(clone);
      }
    }
  };

  function pad(n) { return String(n).padStart(2,'0'); }
  function formatDateForFilename(d) {
    // MMDDYYYY
    const mm = pad(d.getMonth()+1);
    const dd = pad(d.getDate());
    const yyyy = d.getFullYear();
    return `${mm}${dd}${yyyy}`;
  }

  function sanitizeFinancing(f) {
    // remove the word 'Financing' if present and trim
    return String(f).replace(/\s*Financing$/i, '').trim();
  }

  return (
    <div className="real-estate-app" data-theme={isDarkTheme ? 'dark' : 'light'}>
      {/* Computation Inputs Card */}
      <div className="card data-entry-card" style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <h2 style={{ margin: 0 }}>Compute-We Data Entry</h2>
          <div style={{ textAlign: 'right' }}>
            <div className="clock">{currentTime}</div>
            <button
              className="theme-toggle"
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              aria-label="Toggle theme"
              title={isDarkTheme ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{ marginTop: '6px' }}
            >
              {isDarkTheme ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>
        <div className="row">
          <div className="col">
            <label htmlFor="price">Total Contract Price</label>
            <input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </div>
          <div className="col">
            <label htmlFor="financing">Financing Type</label>
            <select
              id="financing"
              value={financing}
              onChange={(e) => setFinancing(e.target.value)}
            >
              {Object.keys(financingOptions).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="col">
            <label htmlFor="reservation">Reservation Fee</label>
            <input
              id="reservation"
              type="number"
              value={reservation}
              onChange={(e) => setReservation(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: '18px' }}>
          {financing === 'Bank Financing' ? (
            <div className="col">
              <label htmlFor="dpPercent">Down Payment %</label>
              <input
                id="dpPercent"
                type="number"
                value={dpPercent}
                onChange={(e) => setDpPercent(Number(e.target.value))}
              />
            </div>
          ) : (
            <div className="col">
              <label htmlFor="dpAmount">Down Payment Amount (₱)</label>
              <input
                id="dpAmount"
                type="number"
                value={dpAmount}
                onChange={(e) => setDpAmount(Number(e.target.value))}
              />
            </div>
          )}
          <div className="col">
            <label htmlFor="loanTerm">Loan Term (years)</label>
            <select
              id="loanTerm"
              value={loanTerm}
              onChange={(e) => setLoanTerm(Number(e.target.value))}
            >
              {loanTerms.map((term) => (
                <option key={term} value={term}>
                  {term} years
                </option>
              ))}
            </select>
          </div>
          <div className="col">
            <label htmlFor="interest">Interest Rate (%)</label>
            <input
              id="interest"
              type="number"
              step="0.01"
              value={interest}
              onChange={(e) => setInterest(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: '18px' }}>
          <div className="col">
            <label htmlFor="dpMonths">Down Payment Term (months)</label>
            <select
              id="dpMonths"
              value={dpMonths}
              onChange={(e) => setDpMonths(Number(e.target.value))}
            >
              {Array.from({ length: 36 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m} {m === 1 ? 'month' : 'months'}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: '18px' }}>
          <div className="col">
            <label htmlFor="projectName">Project Name</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input id="projectName" type="text" list="projectNames" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Select or type custom project" style={{ flex: 1 }} />
              <button type="button" className="clear-btn" aria-label="clear project" onClick={() => setProjectName('')}>×</button>
            </div>
            <datalist id="projectNames">
              <option value="Anyana" />
              <option value="Antel Grand Village" />
              <option value="Beyond Homes South Vill 2" />
              <option value="Bellefort Estate" />
              <option value="Brookstone Park" />
              <option value="Carmona Estate" />
              <option value="Emerald Residences" />
              <option value="Golden Horizon" />
              <option value="Idesia Dasma" />
              <option value="Istana Tanza" />
              <option value="Kaia Homes" />
              <option value="Lanello Heights" />
              <option value="Lancaster New City Cavite" />
              <option value="Liora Homes Naic" />
              <option value="Maple Tree Residences" />
              <option value="Micara Estates 2" />
              <option value="Minami Residences" />
              <option value="Monte Royale" />
              <option value="Monterra Verde 2" />
              <option value="Naic Country Homes" />
              <option value="Neuville Townhomes" />
              <option value="Northdale Estate" />
              <option value="Nova Stella Residences Ph2" />
              <option value="Pacifictown Enclave" />
              <option value="Pacifictown Naic" />
              <option value="Paradisimo" />
              <option value="Parkinfina" />
              <option value="Parksville" />
              <option value="Portico Hills" />
              <option value="Richdale West Residences" />
              <option value="Sapphire Residences" />
              <option value="Southdale Villas" />
              <option value="Southscapes Trece" />
              
              <option value="Tarragona Place" />
              <option value="Treelane Residences" />
              <option value="Valle Verde Dasma" />
              <option value="Verdanza" />
              <option value="Westwind" />
              <option value="Woodtown Residences" />
            </datalist>
          </div>
          <div className="col">
            <label htmlFor="houseModel">House Model</label>
            <input id="houseModel" type="text" value={houseModel} onChange={(e) => setHouseModel(e.target.value)} />
          </div>
          <div className="col">
            <label htmlFor="lotArea">Lot Area (sq.m.)</label>
            <input id="lotArea" type="number" value={lotArea} onChange={(e) => setLotArea(e.target.value)} />
          </div>
        </div>

        <div className="row" style={{ marginTop: '12px' }}>
          <div className="col">
            <label htmlFor="lotType">Lot Type</label>
            <select id="lotType" value={lotType} onChange={(e) => setLotType(e.target.value)}>
              <option>Inner Lot</option>
              <option>End Lot</option>
              <option>Corner Lot</option>
            </select>
          </div>
          <div className="col">
            <label htmlFor="constructionStatus">Construction Status</label>
            <select id="constructionStatus" value={constructionStatus} onChange={(e) => setConstructionStatus(e.target.value)}>
              <option>Pre-Selling</option>
              <option>On-Going Construction</option>
              <option>Ready for Occupancy (RFO)</option>
            </select>
          </div>
          <div className="col">
            <label htmlFor="dateGenerated">Date Generated</label>
            <input id="dateGenerated" type="text" value={dateGenerated} readOnly />
          </div>
        </div>

        <div className="row" style={{ marginTop: '12px' }}>
          <div className="col">
            <button onClick={handleOkay} className="btn btn-primary">Okay</button>
            <button onClick={handleReset} className="btn btn-success" style={{ marginLeft: 8 }}>Reset</button>
          </div>
        </div>
      </div>

      {/* Simple Computation Table */}
      <div className="card computation-card" ref={simpleTableRef} style={{ aspectRatio: '4/5', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <h2>Sample Computation - {financing}</h2>
        {computationData && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ marginBottom: 12 }}>
              <table>
                <tbody>
                  <tr>
                    <td><strong>Project Name</strong></td>
                    <td>{projectName || '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>House Model</strong></td>
                    <td>{houseModel || '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Lot Area</strong></td>
                    <td>{lotArea ? `${lotArea} sq.m.` : '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Lot Type</strong></td>
                    <td>{lotType}</td>
                  </tr>
                  <tr>
                    <td><strong>Construction Status</strong></td>
                    <td>{constructionStatus}</td>
                  </tr>
                  <tr>
                    <td><strong>Date Generated</strong></td>
                    <td>{dateGenerated || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <table>
              <thead>
                <tr>
                  <th colSpan="2">Down Payment Summary</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Total Contract Price</strong>
                  </td>
                  <td>
                    <strong>{fmtCurrency(computationData.price)}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Required Down Payment ({financing === 'Bank Financing' ? `${dpPercent}%` : 'Amount'})</td>
                  <td>{fmtCurrency(computationData.dpBase)}</td>
                </tr>
                <tr>
                  <td>Less: Reservation Fee</td>
                  <td>-{fmtCurrency(reservation)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Total Down Payment</strong>
                  </td>
                  <td>
                    <strong>{fmtCurrency(computationData.dpFinal)}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Down Payment Term</td>
                  <td>{dpMonths} months</td>
                </tr>
                <tr>
                  <td>Monthly Down Payment</td>
                  <td>{fmtCurrency(computationData.monthlyDP)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '12px' }}>
              <table>
                <tbody>
                  <tr>
                    <td><strong>Loanable Amount</strong></td>
                    <td><strong>{fmtCurrency(computationData.loanAmount)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <table style={{ marginTop: '16px' }}>
              <thead>
                <tr>
                  <th>Loan Term</th>
                  <th>Monthly Amortization</th>
                  <th>Required Income</th>
                </tr>
              </thead>
              <tbody>
                {computationData.amortizationData.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.term} years</td>
                    <td>{fmtCurrencyRounded(row.monthly)}</td>
                    <td>{fmtCurrencyRounded(row.requiredIncome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="muted" style={{ marginTop: '18px' }}>
              "This sample computation is for the purpose of illustration and is subject to possible change without prior notice."
            </p>
          </div>
        )}
      </div>

      {/* Export Buttons Card */}
      <div className="card">
        <button id="saveJpegBtn" onClick={handleSaveJpeg} className="btn btn-primary" disabled={generationNumber <= 0} title={generationNumber <= 0 ? 'Generate computation first (click Okay)' : 'Save as JPEG'}>
          Save as JPEG
        </button>
        <button id="savePdfBtn" onClick={handleSavePdf} className="btn btn-success" disabled={generationNumber <= 0} title={generationNumber <= 0 ? 'Generate computation first (click Okay)' : 'Export as PDF'}>
          Export as PDF
        </button>
      </div>
    </div>
  );
}
