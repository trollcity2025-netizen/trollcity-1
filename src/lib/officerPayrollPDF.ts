// Officer Payroll PDF Generator
// Generates PDF reports for officer monthly payroll

// Note: You'll need to install jspdf and jspdf-autotable:
// npm install jspdf jspdf-autotable
// npm install --save-dev @types/jspdf

interface PayrollReport {
  username: string
  email: string
  month: string
  total_hours: number
  total_coins: number
  unpaid_coins: number
  auto_clockouts: number
  total_shifts: number
}

/**
 * Downloads a PDF payroll report for an officer
 * @param report - The payroll report data from officer_monthly_payroll view
 */
export async function downloadPayrollPDF(report: PayrollReport) {
  try {
    // Dynamic import for jspdf
    const jsPDFModule = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    
    const jsPDF = jsPDFModule.default || jsPDFModule
    const autoTable = autoTableModule.default || autoTableModule
    
    const doc = new jsPDF()

    // Title
    doc.setFontSize(18)
    doc.text('Troll Officer Monthly Payroll Report', 14, 22)

    // Officer Information
    doc.setFontSize(12)
    doc.text(`Officer: ${report.username}`, 14, 35)
    doc.text(`Email: ${report.email}`, 14, 42)
    
    // Format month
    const monthDate = new Date(report.month)
    const monthFormatted = monthDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    })
    doc.text(`Month: ${monthFormatted}`, 14, 49)

    // Payroll Summary Table
    autoTable(doc, {
      startY: 60,
      head: [['Metric', 'Value']],
      body: [
        ['Total Hours', Number(report.total_hours || 0).toFixed(2)],
        ['Coins Earned', Number(report.total_coins || 0).toLocaleString()],
        ['Unpaid Coins', Number(report.unpaid_coins || 0).toLocaleString()],
        ['Auto Clock-Outs', report.auto_clockouts?.toString() || '0'],
        ['Total Shifts', report.total_shifts?.toString() || '0'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
      styles: { fontSize: 10 }
    })

    // Conversion and payout info
    const finalY = (doc as any).lastAutoTable?.finalY || 100
    doc.setFontSize(10)
    doc.text('Coin Conversion: 100 coins = $1 USD', 14, finalY + 15)
    
    const estimatedPayout = (Number(report.total_coins || 0) * 0.01).toFixed(2)
    doc.setFontSize(12)
    doc.text(`Estimated Payout: $${estimatedPayout}`, 14, finalY + 25)
    
    if (Number(report.unpaid_coins || 0) > 0) {
      const unpaidPayout = (Number(report.unpaid_coins || 0) * 0.01).toFixed(2)
      doc.setFontSize(10)
      doc.setTextColor(200, 0, 0)
      doc.text(`Unpaid Amount: $${unpaidPayout}`, 14, finalY + 35)
      doc.setTextColor(0, 0, 0) // Reset color
    }

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`,
      14,
      doc.internal.pageSize.height - 10
    )

    // Save PDF
    const filename = `TrollCity_Payroll_${report.username}_${monthDate.getFullYear()}_${String(monthDate.getMonth() + 1).padStart(2, '0')}.pdf`
    doc.save(filename)
  } catch (error: any) {
    console.error('[OfficerPayrollPDF] Error generating PDF:', error)
    alert('PDF generation failed. Please install jspdf: npm install jspdf jspdf-autotable')
  }
}
