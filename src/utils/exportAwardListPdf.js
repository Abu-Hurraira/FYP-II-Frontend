import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportAwardListPdf(elementId, filename = "Award_List.pdf") {
  const element = typeof elementId === "string" ? document.getElementById(elementId) : elementId;
  if (!element) {
    alert("Award list element not found for PDF export.");
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const margin = 20;
    const availableWidth = pdfWidth - margin * 2;
    const availableHeight = pdfHeight - margin * 2;

    const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
    const finalWidth = imgWidth * ratio;
    const finalHeight = imgHeight * ratio;
    const imgX = (pdfWidth - finalWidth) / 2;
    const imgY = margin;

    pdf.addImage(imgData, "PNG", imgX, imgY, finalWidth, finalHeight);
    pdf.save(filename);
  } catch (err) {
    console.error("PDF export error:", err);
    // Fallback print
    window.print();
  }
}
