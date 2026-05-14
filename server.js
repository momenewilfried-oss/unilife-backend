const express = require("express");
const cors = require("cors");
const path = require("path");
const archiver = require("archiver");
require("dotenv").config();
const PDFDocument = require("pdfkit");

const app = express();

const frontendPath = path.resolve(__dirname, "../unilife-front-end");
app.use("/app", express.static(frontendPath));

app.get("/app/download", (req, res) => {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=unilife-app.zip");

    const archive = new archiver.ZipArchive({
        zlib: { level: 9 }
    });

    archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
            res.status(500).send({ success: false, message: "Erreur de génération du téléchargement" });
        } else {
            res.end();
        }
    });

    archive.pipe(res);
    archive.directory(frontendPath, false);
    archive.finalize();
});

/* =========================
   MIDDLEWARES
========================= */
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

/* =========================
   SUPABASE
========================= */
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =========================
   AUTH
========================= */
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/authMiddleware");

app.use("/api/auth", authRoutes);

/* =========================
   HEALTH
========================= */
app.get("/", (req, res) => {
    res.json({ success: true, message: "UNILIFE ONLINE 🚀" });
});

/* =========================
   GET OR CREATE CLASS
========================= */
async function getOrCreateClass(className, userId) {
    const name = className.trim().toUpperCase();

    const { data } = await supabase
        .from("classes")
        .select("*")
        .eq("name", name)
        .eq("user_id", userId)
        .maybeSingle();

    if (data) return data.id;

    const { data: created, error } = await supabase
        .from("classes")
        .insert([{ name, user_id: userId }])
        .select()
        .single();

    if (error) throw error;

    return created.id;
}

/* =========================
   SAVE BULLETIN
========================= */
app.post("/save", authMiddleware, async (req, res) => {
    try {
        const { class_name, student_name, moyenne, mention, total_coef, subjects } = req.body;
        const userId = req.user.id;

        const classId = await getOrCreateClass(class_name, userId);

        const { data: student, error } = await supabase
            .from("students")
            .insert([{
                nom: student_name,
                moyenne,
                mention,
                total_coef,
                class_id: classId,
                user_id: userId
            }])
            .select("id")
            .single();

        if (error) throw error;

        const studentId = student.id;

        // ⚠️ IMPORTANT: pas de user_id ici
        const subjectRows = subjects.map(s => ({
            student_id: studentId,
            nom_matiere: s.nom_matiere,
            note: s.note,
            coef: s.coef
        }));

        const { error: subErr } = await supabase
            .from("subjects")
            .insert(subjectRows);

        if (subErr) throw subErr;

        res.json({ success: true, studentId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   LIST STUDENTS (SECURE)
========================= */
app.get("/students", authMiddleware, async (req, res) => {
    const userId = req.user.id;

    const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", userId);

    if (error) return res.status(500).json({ error });

    res.json(data);
});

/* =========================
   SECURITY CHECK FUNCTION
========================= */
async function checkStudentOwner(studentId, userId) {
    const { data } = await supabase
        .from("students")
        .select("id")
        .eq("id", studentId)
        .eq("user_id", userId)
        .maybeSingle();

    return !!data;
}

/* =========================
   PDF SECURE ROUTE
========================= */
app.get("/student/:id/pdf", authMiddleware, async (req, res) => {
    try {
        const studentId = req.params.id;
        const userId = req.user.id;

        const { data: student, error: studentError } = await supabase
            .from("students")
            .select(`*, classes(name)`)
            .eq("id", studentId)
            .eq("user_id", userId)
            .maybeSingle();

        if (!student || studentError) {
            return res.status(403).json({ success: false, message: "Accès refusé" });
        }

        const { data: subjects } = await supabase
            .from("subjects")
            .select("*")
            .eq("student_id", studentId);

        const totalCoef = subjects.reduce((sum, subject) => sum + (Number(subject.coef) || 0), 0);
        const average = student.moyenne ?? 0;
        const mention = student.mention ?? "N/A";
        const year = new Date().getFullYear();
        const academicYear = `${year - 1}/${year}`;
        const institutionName = req.user.name || "UNILIFE UNIVERSITY";

        const doc = new PDFDocument({ size: "A4", margins: { top: 50, left: 50, right: 50, bottom: 50 } });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=bulletin-${student.nom}.pdf`);

        doc.pipe(res);

        const brandBlue = "#2563eb";
        const nightBlue = "#1e293b";
        const lightGrey = "#f8fafc";
        const softGrey = "#e2e8f0";
        const textDark = "#0f172a";
        const accentGreen = "#16a34a";
        const accentOrange = "#f59e0b";
        const accentRed = "#dc2626";
        const accentBlue = "#3b82f6";

        // Header premium
        doc.rect(50, 50, doc.page.width - 100, 140).fill(nightBlue);
        doc.fillColor("white").font("Helvetica-Bold").fontSize(22).text(institutionName.toUpperCase(), 60, 68, { align: "left" });
        doc.font("Helvetica").fontSize(10).fillColor("#cbd5e1").text("etablissement d'enseignement secondaire | Bulletin officiel ", 60, 98, { width: 320, lineGap: 2 });
        doc.fillColor(brandBlue).rect(60, 128, 140, 6).fill();
        doc.font("Helvetica-Bold").fontSize(14).fillColor("white").text("BULLETIN DE NOTES", 60, 142);

        doc.font("Helvetica").fontSize(10).fillColor("#cbd5e1").text(`Date : ${new Date().toLocaleDateString("fr-FR")}`, doc.page.width - 200, 72, { width: 140, align: "right" });
        doc.text(`Année académique : ${academicYear}`, { width: 140, align: "right" });

        // Fiche étudiant
        const cardTop = 210;
        const cardHeight = 130;
        doc.roundedRect(50, cardTop, doc.page.width - 100, cardHeight, 12).fill(lightGrey).stroke();
        doc.fillColor(textDark).font("Helvetica-Bold").fontSize(12).text("Fiche étudiant", 64, cardTop + 18);
        doc.font("Helvetica").fontSize(10).fillColor(nightBlue);
        doc.text(`Nom : ${student.nom}`, 64, cardTop + 42);
        doc.text(`Identifiant : ${student.id}`, 64, cardTop + 58);
        doc.text(`Classe : ${student.classes?.name ?? "Non renseignée"}`, 64, cardTop + 74);

        doc.text(`Moyenne générale : ${average.toFixed(2)}`, doc.page.width / 2 + 10, cardTop + 42, { width: 200, align: "left" });
        doc.text(`Mention : ${mention}`, doc.page.width / 2 + 10, cardTop + 58, { width: 200, align: "left" });
        doc.text(`Total des coefficients : ${totalCoef}`, doc.page.width / 2 + 10, cardTop + 74, { width: 200, align: "left" });

        // Tableau de matières
        const tableTop = cardTop + cardHeight + 30;
        const tableLeft = 50;
        const tableWidth = doc.page.width - 100;
        const rowHeight = 22;
        const colWidths = [tableWidth * 0.45, tableWidth * 0.17, tableWidth * 0.17, tableWidth * 0.21];

        doc.fillColor(nightBlue).rect(tableLeft, tableTop, tableWidth, 28).fill();
        doc.fillColor("white").font("Helvetica-Bold").fontSize(11);
        doc.text("Matière", tableLeft + 12, tableTop + 8, { width: colWidths[0] });
        doc.text("Note", tableLeft + colWidths[0] + 12, tableTop + 8, { width: colWidths[1] });
        doc.text("Coefficient", tableLeft + colWidths[0] + colWidths[1] + 12, tableTop + 8, { width: colWidths[2] });
        doc.text("Observation", tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 12, tableTop + 8, { width: colWidths[3] });

        let currentY = tableTop + 28;
        subjects.forEach((subject, index) => {
            const rowColor = index % 2 === 0 ? "#f8fafc" : "#ffffff";
            doc.fillColor(rowColor).rect(tableLeft, currentY, tableWidth, rowHeight).fill();

            const observation = subject.note >= 16 ? "Excellent" : subject.note >= 14 ? "Très bien" : subject.note >= 12 ? "Bien" : subject.note >= 10 ? "Assez bien" : "À améliorer";
            doc.fillColor(textDark).font("Helvetica").fontSize(10);
            doc.text(subject.nom_matiere, tableLeft + 12, currentY + 6, { width: colWidths[0] });
            doc.text(subject.note?.toString() ?? "N/A", tableLeft + colWidths[0] + 12, currentY + 6, { width: colWidths[1] });
            doc.text(subject.coef?.toString() ?? "N/A", tableLeft + colWidths[0] + colWidths[1] + 12, currentY + 6, { width: colWidths[2] });
            doc.text(observation, tableLeft + colWidths[0] + colWidths[1] + colWidths[2] + 12, currentY + 6, { width: colWidths[3] });

            doc.strokeColor(softGrey).lineWidth(0.5).moveTo(tableLeft, currentY + rowHeight).lineTo(tableLeft + tableWidth, currentY + rowHeight).stroke();
            currentY += rowHeight;
        });

        // Résultat final
        const resultTop = currentY + 30;
        const resultHeight = 100;
        doc.roundedRect(tableLeft, resultTop, tableWidth, resultHeight, 12).fill(lightGrey).stroke();

        const badgeColor = mention === "Très Bien" ? accentGreen : mention === "Bien" ? accentBlue : mention === "Assez Bien" ? accentOrange : accentRed;
        doc.fillColor(textDark).font("Helvetica-Bold").fontSize(12).text("Résultat final", tableLeft + 18, resultTop + 18);
        doc.font("Helvetica-Bold").fontSize(36).fillColor(nightBlue).text(`${average.toFixed(2)}`, tableLeft + 18, resultTop + 42);
        doc.font("Helvetica-Bold").fontSize(14).fillColor(badgeColor).text(mention, tableLeft + 140, resultTop + 72, { align: "left" });

        // Footer
        const footerY = doc.page.height - 80;
        doc.strokeColor(softGrey).lineWidth(0.5).moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).stroke();
        doc.font("Helvetica").fontSize(9).fillColor(textDark).text("Document généré automatiquement par UNILIFE", 50, footerY + 12);
        doc.text("Signature administration de l'école", 50, footerY + 26);
        doc.text(`Page 1 / 1`, doc.page.width - 110, footerY + 12, { align: "right", width: 60 });

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Erreur PDF" });
    }
});

/* =========================
   START
========================= */
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log("RUNNING ON", PORT));