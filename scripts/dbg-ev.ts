import { db } from "../src/lib/db";

(async () => {
  // Find the "Rohit kumar" user (demo Site Data Entry) and their scope.
  const users = await db.user.findMany({
    where: { OR: [{ name: { contains: "Rohit", mode: "insensitive" } }, { email: { contains: "rohit", mode: "insensitive" } }] },
    select: { id: true, name: true, email: true, employeeId: true, role: true, projectId: true, businessUnitId: true, subsidiaryId: true },
  });
  console.log("USERS:");
  users.forEach((u) => console.log(" ", u.name, "|", u.email, "|", u.employeeId, "| role:", u.role, "| proj:", u.projectId?.slice(0, 12) ?? "-", "| bu:", u.businessUnitId?.slice(0, 12) ?? "-"));

  // Level records blob — look for items whose fields are OBJECTS (React #300 cause).
  const row = await db.appSetting.findUnique({ where: { skey: "level_records_blob" }, select: { svalue: true } });
  if (!row?.svalue) { console.log("no blob"); process.exit(0); }
  const records = JSON.parse(Buffer.from(row.svalue, "base64").toString("utf-8"));
  console.log("\nblob records:", records.length);

  const objFields = new Set<string>();
  for (const rec of records) {
    for (const it of Array.isArray(rec?.data?.items) ? rec.data.items : []) {
      for (const [k, v] of Object.entries(it ?? {})) {
        if (v && typeof v === "object") objFields.add(`${rec.levelKey}.${k}=${Array.isArray(v) ? "array" : "object"}`);
      }
    }
    for (const [k, v] of Object.entries(rec?.data ?? {})) {
      if (v && typeof v === "object" && !Array.isArray(v)) objFields.add(`${rec.levelKey}.data.${k}=object`);
    }
  }
  console.log("object-valued fields found:", [...objFields].slice(0, 30));
  process.exit(0);
})();
