import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { year } from "@/config/site";
import { requireRole } from "@/server/auth/access";
import { getSelectionOverview } from "@/server/services/selection";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#0F172A", fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  subtitle: { fontSize: 10, color: "#64748B", marginBottom: 18 },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 10,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#DCFCE7",
    paddingVertical: 7,
    paddingHorizontal: 5,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
  },
  rank: { width: "7%" },
  name: { width: "35%" },
  registration: { width: "22%" },
  major: { width: "10%" },
  score: { width: "10%", textAlign: "right" },
  status: { width: "16%", textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#64748B",
    textAlign: "center",
  },
});

function SelectionMinutes({
  rows,
  counts,
}: {
  rows: Awaited<ReturnType<typeof getSelectionOverview>>["publishedRows"];
  counts: { passed: number; waitlisted: number; failed: number };
}) {
  return (
    <Document title={`Berita Acara Seleksi ${year}`}>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>Berita Acara Seleksi SPMB</Text>
        <Text style={styles.subtitle}>
          SMK Citra Negara · Tahun Ajaran {year}/{year + 1} · Gelombang 1
        </Text>
        <View style={styles.summary}>
          <Text>Lulus: {counts.passed}</Text>
          <Text>Cadangan: {counts.waitlisted}</Text>
          <Text>Tidak lulus: {counts.failed}</Text>
        </View>
        <View style={styles.tableHeader} fixed>
          <Text style={styles.rank}>Rank</Text>
          <Text style={styles.name}>Peserta</Text>
          <Text style={styles.registration}>Nomor pendaftaran</Text>
          <Text style={styles.major}>Jurusan</Text>
          <Text style={styles.score}>Nilai</Text>
          <Text style={styles.status}>Hasil</Text>
        </View>
        {rows.map((row) => (
          <View key={row.id} style={styles.row} wrap={false}>
            <Text style={styles.rank}>{row.rank ?? "—"}</Text>
            <Text style={styles.name}>{row.fullName}</Text>
            <Text style={styles.registration}>{row.registrationNumber}</Text>
            <Text style={styles.major}>{row.majorCode}</Text>
            <Text style={styles.score}>
              {row.finalScore?.toLocaleString("id-ID", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }) ?? "—"}
            </Text>
            <Text style={styles.status}>
              {row.status === "PASS"
                ? "Lulus"
                : row.status === "WAITLIST"
                  ? "Cadangan"
                  : "Tidak lulus"}
            </Text>
          </View>
        ))}
        <Text
          fixed
          render={({ pageNumber, totalPages }) =>
            `Dokumen internal panitia · Halaman ${pageNumber} dari ${totalPages}`
          }
          style={styles.footer}
        />
      </Page>
    </Document>
  );
}

export async function GET() {
  await requireRole("ADMIN");
  const overview = await getSelectionOverview();
  if (!overview.publishedPublication) {
    return new Response("Hasil seleksi belum dipublikasikan.", {
      status: 409,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  const rows = overview.publishedRows;
  const counts = {
    passed: rows.filter((row) => row.status === "PASS").length,
    waitlisted: rows.filter((row) => row.status === "WAITLIST").length,
    failed: rows.filter((row) => row.status === "FAIL").length,
  };
  const pdf = await renderToBuffer(
    <SelectionMinutes counts={counts} rows={rows} />,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="berita-acara-seleksi-${year}.pdf"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
