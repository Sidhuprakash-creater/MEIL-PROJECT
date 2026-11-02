#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# PU-LINK END-TO-END BACKEND VERIFICATION (v2)
# Portal user → draft → evidence → submit → mirror → SM decision → reflection
# → resubmit loop → Group decision → task push → evidence visibility → security.
# ═══════════════════════════════════════════════════════════════════════════
set -u
BASE="http://localhost:3000"
PASS=0; FAIL=0
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
bad(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }
section(){ echo; echo "━━ $1 ━━"; }

PROJECT_ID="cmvnymjey005cozk1rgvr89xx"      # Gayatri Solar Plant (portal)

# ── Phase A: portal user signs in + drafts data ───────────────────────────
section "A. PROJECT USER PORTAL — sign in + draft data entry"
PU_LOGIN=$(curl -s --max-time 15 -X POST $BASE/api/pu/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"rohit@meil-esg.in","password":"esg12345"}' -c /tmp/e2e_pu.jar)
echo "$PU_LOGIN" | grep -q PROJECT_USER && ok "PU login ok (Rohit Kumar · PROJECT_USER)" || bad "PU login failed: $(echo "$PU_LOGIN" | head -c 200)"

PERIOD_ID=$(curl -s --max-time 15 "$BASE/api/pu/overview" -b /tmp/e2e_pu.jar | python3 -c "import json,sys; print(json.load(sys.stdin)['periods'][0]['id'])")
[ -n "$PERIOD_ID" ] && ok "Reporting period resolved" || bad "no period"

DE_POST=$(curl -s --max-time 20 -X POST $BASE/api/pu/data-entry -b /tmp/e2e_pu.jar -H 'Content-Type: application/json' -d "{
  \"level\": 1, \"levelKey\": \"LEVEL_1_ENERGY\", \"levelName\": \"Energy Consumption\",
  \"module\": \"LEVEL_1_ENERGY\", \"projectId\": \"$PROJECT_ID\", \"reportingPeriodId\": \"$PERIOD_ID\",
  \"data\": {\"consumptionQuantity\": 4800, \"unit\": \"kWh\", \"energySource\": \"Grid electricity\",
             \"openingMeterReading\": 5200, \"closingMeterReading\": 10000,
             \"energyPurchased\": 5000, \"remarks\": \"E2E v2 bridge verification\"}
}")
RECORD_ID=$(echo "$DE_POST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('record',{}).get('id',''))")
SUB_ID=$(echo "$DE_POST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('submissionId') or d.get('submission',{}).get('id',''))")
[ -n "$RECORD_ID" ] && ok "Draft record created: $RECORD_ID" || bad "data-entry failed: $(echo "$DE_POST" | head -c 240)"
[ -n "$SUB_ID" ] && ok "Draft submission synced: $SUB_ID" || bad "no submissionId"

# ── Phase B: evidence upload BEFORE submit (real multipart file) ──────────
section "B. EVIDENCE UPLOAD (real file, linked to the record)"
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF\n' > /tmp/e2e_evidence.pdf
EV_POST=$(curl -s --max-time 20 -X POST $BASE/api/pu/evidence -b /tmp/e2e_pu.jar \
  -F "file=@/tmp/e2e_evidence.pdf;type=application/pdf" \
  -F "documentType=METER_READING" -F "module=LEVEL_1_ENERGY" \
  -F "projectId=$PROJECT_ID" -F "periodId=$PERIOD_ID" -F "sourceRecordId=$RECORD_ID")
EV_URL=$(echo "$EV_POST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('evidence',{}).get('filePath',''))")
case "$EV_URL" in /evidence-uploads/*) ok "Evidence stored: $EV_URL";; *) bad "evidence upload failed: $(echo "$EV_POST" | head -c 200)";; esac
EV_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE$EV_URL")
[ "$EV_HTTP" = "200" ] && ok "Evidence file served (HTTP 200)" || bad "evidence file not served ($EV_HTTP)"

# ── Phase C: submit → mirror into the platform ────────────────────────────
section "C. SUBMIT → PLATFORM MIRROR"
SUB_RES=$(curl -s --max-time 20 -X POST "$BASE/api/pu/submissions/$SUB_ID/submit" -b /tmp/e2e_pu.jar -H 'Content-Type: application/json' -d '{"comment":"E2E submit"}')
echo "$SUB_RES" | grep -q '"status":"SUBMITTED"' && ok "Portal submission → SUBMITTED" || bad "submit failed: $(echo "$SUB_RES" | head -c 240)"

# Group Admin session
curl -s --max-time 15 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"portal":"group","role":"GROUP_ADMIN","employeeId":"GRP-0001","password":"Esg@2025"}' -c /tmp/e2e_grp.jar > /dev/null
SUB_ID_ENR=$(curl -s --max-time 15 "$BASE/api/esg/org?type=subsidiaries&light=1" -b /tmp/e2e_grp.jar | python3 -c "
import json,sys
d=json.load(sys.stdin)
subs=d.get('subsidiaries') or (d if isinstance(d,list) else [])
tgt=[s for s in subs if s.get('code')=='SUB-ENR']
print(tgt[0]['id'] if tgt else (subs[0]['id'] if subs else ''))
")
MIRROR=$(curl -s --max-time 15 "$BASE/api/esg/submissions" -b /tmp/e2e_grp.jar | python3 -c "
import json,sys
d=json.load(sys.stdin)
rows=[s for s in d.get('submissions',[]) if s.get('sourceRef')=='$SUB_ID']
m=rows[0] if rows else None
if m: print(m['id'],'|',m['ref'],'|',m.get('status'),'|',m.get('subsidiaryName'),'|',m.get('projectName'),'|',m.get('submittedByName'),'|',json.dumps(m.get('evidence',[])))
else: print('NONE')
")
if echo "$MIRROR" | grep -q "^NONE"; then bad "mirror not visible to Group Admin"; MIRROR_ID=""; MIRROR_REF="";
else
  MIRROR_ID=$(echo "$MIRROR" | cut -d'|' -f1 | xargs)
  MIRROR_REF=$(echo "$MIRROR" | cut -d'|' -f2 | xargs)
  MIRROR_STATUS=$(echo "$MIRROR" | cut -d'|' -f3 | xargs)
  MIRROR_PROJ=$(echo "$MIRROR" | cut -d'|' -f5 | xargs)
  ok "Mirror visible: $MIRROR_REF ($MIRROR_STATUS) · $(echo "$MIRROR" | cut -d'|' -f4 | xargs) · $MIRROR_PROJ"
  echo "$MIRROR" | grep -q "e2e_evidence.pdf" && ok "Mirror carries the portal evidence file" || bad "evidence missing on mirror"
  echo "$MIRROR" | grep -q "Rohit Kumar" && ok "Sender attribution on mirror: Rohit Kumar" || bad "no sender attribution"
  echo "$MIRROR_PROJ" | grep -qi "solar" && ok "Project mapping: solar site → solar project ($MIRROR_PROJ)" || bad "project mapping off: $MIRROR_PROJ"
fi

# ── Phase D: SM queue + decision → portal reflection ──────────────────────
section "D. SUBSIDIARY MANAGER decision → portal reflection"
curl -s --max-time 15 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"portal\":\"subsidiary\",\"role\":\"SUBSIDIARY_MANAGER\",\"employeeId\":\"SUB-1001\",\"password\":\"Esg@2025\",\"subsidiaryId\":\"$SUB_ID_ENR\"}" -c /tmp/e2e_sm.jar > /dev/null
SM_QUEUE=$(curl -s --max-time 15 "$BASE/api/sm/submissions?tab=queue" -b /tmp/e2e_sm.jar)
echo "$SM_QUEUE" | grep -q "$MIRROR_REF" && ok "SM queue contains $MIRROR_REF" || bad "SM queue missing $MIRROR_REF"
SM_DEC=$(curl -s --max-time 20 -X POST "$BASE/api/sm/submissions/$MIRROR_ID/decision" -b /tmp/e2e_sm.jar -H 'Content-Type: application/json' \
  -d '{"action":"approve","reason":"Verified against meter logs and site evidence"}')
echo "$SM_DEC" | grep -q '"action":"approve"' && ok "SM approved $MIRROR_REF" || bad "SM decision failed: $(echo "$SM_DEC" | head -c 240)"
PU_AFTER=$(curl -s --max-time 15 "$BASE/api/pu/submissions/$SUB_ID" -b /tmp/e2e_pu.jar)
PU_STATUS=$(echo "$PU_AFTER" | python3 -c "import json,sys; print(json.load(sys.stdin)['submission']['status'])")
[ "$PU_STATUS" = "SUBSIDIARY_APPROVED" ] && ok "Portal fast-forwarded → SUBSIDIARY_APPROVED" || bad "portal status is $PU_STATUS (expected SUBSIDIARY_APPROVED)"
PU_NOTIF=$(curl -s --max-time 15 "$BASE/api/pu/notifications" -b /tmp/e2e_pu.jar)
echo "$PU_NOTIF" | grep -q "Approved: " && ok "Sender notified of approval" || bad "sender approval notification missing"
echo "$PU_NOTIF" | grep -q "Rajesh Menon" && ok "Decision attributed to Rajesh Menon (Subsidiary Manager)" || bad "no reviewer attribution in portal"

# ── Phase E: reject → correction → resubmit loop ──────────────────────────
section "E. REJECT → CORRECTION → RESUBMIT LOOP"
DE2=$(curl -s --max-time 20 -X POST $BASE/api/pu/data-entry -b /tmp/e2e_pu.jar -H 'Content-Type: application/json' -d "{
  \"level\": 2, \"levelKey\": \"LEVEL_2_WATER\", \"levelName\": \"Water Withdrawal\",
  \"module\": \"LEVEL_2_WATER\", \"projectId\": \"$PROJECT_ID\", \"reportingPeriodId\": \"$PERIOD_ID\",
  \"submitForReview\": true,
  \"data\": {\"quantityWithdrawn\": 1500, \"unit\": \"KL\", \"sourceType\": \"Ground water\", \"remarks\": \"E2E reject-path record\"}
}")
SUB2=$(echo "$DE2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('submissionId',''))")
[ -n "$SUB2" ] && ok "Second submission created+submitted: $SUB2" || bad "second data-entry failed"
MIRROR2=$(curl -s --max-time 15 "$BASE/api/esg/submissions" -b /tmp/e2e_grp.jar | python3 -c "
import json,sys
d=json.load(sys.stdin)
rows=[s for s in d.get('submissions',[]) if s.get('sourceRef')=='$SUB2']
print(rows[0]['id'] if rows else 'NONE')
")
if [ "$MIRROR2" != "NONE" ]; then
  ok "Second mirror visible: $MIRROR2"
  SM_REJ=$(curl -s --max-time 20 -X POST "$BASE/api/sm/submissions/$MIRROR2/decision" -b /tmp/e2e_sm.jar -H 'Content-Type: application/json' \
    -d '{"action":"reject","reason":"Withdrawal figure mismatches the pump log — correct quantity and attach the log extract"}')
  echo "$SM_REJ" | grep -q '"action":"reject"' && ok "SM rejected mirror 2 with reason" || bad "reject failed: $(echo "$SM_REJ" | head -c 200)"
  PU_ST3=$(curl -s --max-time 15 "$BASE/api/pu/submissions/$SUB2" -b /tmp/e2e_pu.jar | python3 -c "import json,sys; print(json.load(sys.stdin)['submission']['status'])")
  [ "$PU_ST3" = "CORRECTION_REQUESTED" ] && ok "Portal status → CORRECTION_REQUESTED" || bad "portal status $PU_ST3"
  curl -s --max-time 15 "$BASE/api/pu/notifications" -b /tmp/e2e_pu.jar | grep -q "Changes required" && ok "Sender sees the rejection notification" || bad "rejection notification missing"
  RESUB=$(curl -s --max-time 20 -X POST "$BASE/api/pu/submissions/$SUB2/resubmit" -b /tmp/e2e_pu.jar -H 'Content-Type: application/json' -d '{"comment":"Corrected to 1495 KL per pump log; log extract attached"}')
  echo "$RESUB" | grep -q '"UNDER_REVIEW"' && ok "Portal resubmit → UNDER_REVIEW" || bad "resubmit failed: $(echo "$RESUB" | head -c 200)"
  M2_STATUS=$(curl -s --max-time 15 "$BASE/api/esg/submissions?id=$MIRROR2" -b /tmp/e2e_grp.jar | python3 -c "import json,sys; print(json.load(sys.stdin)['submission']['status'])")
  [ "$M2_STATUS" = "SUBMITTED" ] && ok "Platform mirror back in queue (SUBMITTED) after resubmit" || bad "mirror status after resubmit: $M2_STATUS"
else
  bad "second mirror not found for sourceRef $SUB2"
fi

# ── Phase F: Group Admin direct approval → portal APPROVED ────────────────
section "F. GROUP ADMIN approval → portal APPROVED"
DE3=$(curl -s --max-time 20 -X POST $BASE/api/pu/data-entry -b /tmp/e2e_pu.jar -H 'Content-Type: application/json' -d "{
  \"level\": 4, \"levelKey\": \"LEVEL_4_WASTE\", \"levelName\": \"Waste Generation\",
  \"module\": \"LEVEL_4_WASTE\", \"projectId\": \"$PROJECT_ID\", \"reportingPeriodId\": \"$PERIOD_ID\",
  \"submitForReview\": true,
  \"data\": {\"quantityDisposed\": 2.4, \"unit\": \"TON\", \"disposalMethod\": \"Recycler\", \"transferManifestNumber\": \"MF-7734\", \"remarks\": \"E2E group-approval record\"}
}")
SUB3=$(echo "$DE3" | python3 -c "import json,sys; print(json.load(sys.stdin).get('submissionId',''))")
MIRROR3=$(curl -s --max-time 15 "$BASE/api/esg/submissions" -b /tmp/e2e_grp.jar | python3 -c "
import json,sys
d=json.load(sys.stdin)
rows=[s for s in d.get('submissions',[]) if s.get('sourceRef')=='$SUB3']
print(rows[0]['id'] if rows else 'NONE')
")
if [ "$MIRROR3" != "NONE" ]; then
  ok "Third mirror visible: $MIRROR3"
  GRP_DEC=$(curl -s --max-time 20 -X POST "$BASE/api/esg/submissions" -b /tmp/e2e_grp.jar -H 'Content-Type: application/json' \
    -d "{\"action\":\"approve\",\"id\":\"$MIRROR3\",\"comment\":\"Group-level signoff for consolidation\"}")
  echo "$GRP_DEC" | grep -q '"ok":true' && ok "Group approved $MIRROR3" || bad "group decision failed: $(echo "$GRP_DEC" | head -c 240)"
  PU_ST4=$(curl -s --max-time 15 "$BASE/api/pu/submissions/$SUB3" -b /tmp/e2e_pu.jar | python3 -c "import json,sys; print(json.load(sys.stdin)['submission']['status'])")
  [ "$PU_ST4" = "APPROVED" ] && ok "Portal status → APPROVED (group level)" || bad "portal status $PU_ST4 (expected APPROVED)"
  curl -s --max-time 15 "$BASE/api/pu/notifications" -b /tmp/e2e_pu.jar | grep -q "Arun Bhaskar" && ok "Sender notified of Group approval (Arun Bhaskar)" || bad "group approval notification missing"
  GRP_SUBS_ROW=$(curl -s --max-time 15 "$BASE/api/esg/submissions?id=$MIRROR3" -b /tmp/e2e_grp.jar | python3 -c "
import json,sys
s=json.load(sys.stdin)['submission']
print(s.get('reviewerName'),'|',s.get('status'))
")
  echo "$GRP_SUBS_ROW" | grep -q "Arun Bhaskar" && ok "Mirror attribution: reviewed by Arun Bhaskar (session identity)" || bad "attribution wrong: $GRP_SUBS_ROW"
else
  bad "third mirror not found for sourceRef $SUB3"
fi

# ── Phase G: task assignment → receivers (platform + portal) ──────────────
section "G. TASK + DEADLINE — assigned by Group, visible to receivers"
TASK_POST=$(curl -s --max-time 20 -X POST "$BASE/api/esg/tasks" -b /tmp/e2e_grp.jar -H 'Content-Type: application/json' -d "{
  \"title\":\"E2E v2: Submit April renewable generation data\",\"description\":\"Upload the April generation + evidence pack\",\"category\":\"ENERGY\",
  \"assigneeType\":\"SUBSIDIARY\",\"assigneeLabel\":\"MEIL Energy Ltd\",\"subsidiaryId\":\"$SUB_ID_ENR\",\"recipients\":\"4\",
  \"dueDate\":\"$(date -u -d '+10 days' +%Y-%m-%dT%H:%M:%S.000Z)\",\"priority\":\"HIGH\",\"startDate\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
}")
TASK_REF=$(echo "$TASK_POST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('task',{}).get('ref',''))")
[ -n "$TASK_REF" ] && ok "Task created: $TASK_REF" || bad "task create failed: $(echo "$TASK_POST" | head -c 200)"
SM_NOTIF=$(curl -s --max-time 15 "$BASE/api/sm/notifications?limit=10&filter=all" -b /tmp/e2e_sm.jar)
echo "$SM_NOTIF" | grep -q "Task assigned to your" && ok "Receiver (Subsidiary Manager) sees the task notification" || bad "SM did not receive the task notification"
PU_TASK=$(curl -s --max-time 15 "$BASE/api/pu/notifications" -b /tmp/e2e_pu.jar)
echo "$PU_TASK" | grep -q "New task: E2E v2" && ok "Portal user (site ops) received the task + deadline" || bad "portal task notification missing"
echo "$PU_TASK" | grep -q "due 20" && ok "Deadline date visible in the portal task" || bad "no deadline in portal task"

# ── Phase H: evidence visible to reviewers ────────────────────────────────
section "H. EVIDENCE VISIBILITY — reviewer side"
SM_EV=$(curl -s --max-time 15 "$BASE/api/sm/evidence?pageSize=100" -b /tmp/e2e_sm.jar)
echo "$SM_EV" | grep -q "e2e_evidence.pdf" && ok "SM evidence drawer lists the portal-uploaded evidence" || bad "evidence not visible to SM"
EVDOC_URL=$(echo "$SM_EV" | python3 -c "
import json,sys
d=json.load(sys.stdin)
items=d.get('items') or d.get('docs') or []
for i in items:
    if 'e2e_evidence' in (i.get('name') or ''): print(i.get('fileUrl','')); break
")
case "$EVDOC_URL" in /evidence-uploads/*) ok "EvidenceDoc carries real file URL: $EVDOC_URL";; *) bad "no fileUrl on mirrored evidence doc ('$EVDOC_URL')";; esac
EVHTTP2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE$EVDOC_URL")
[ "$EVHTTP2" = "200" ] && ok "Reviewer can open the evidence file (HTTP 200)" || bad "evidence download broken ($EVHTTP2)"

# ── Phase I: security — scope isolation ───────────────────────────────────
section "I. SECURITY — scope isolation"
OTHER_SUB=$(curl -s --max-time 15 "$BASE/api/esg/org?type=subsidiaries&light=1" -b /tmp/e2e_grp.jar | python3 -c "
import json,sys
d=json.load(sys.stdin)
subs=d.get('subsidiaries') or []
tgt=[s for s in subs if s.get('code')=='SUB-OVS'] or subs[-1:]
print(tgt[0]['id'] if tgt else '')
")
curl -s --max-time 15 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"portal\":\"subsidiary\",\"role\":\"SUBSIDIARY_MANAGER\",\"employeeId\":\"SUB-2001\",\"password\":\"Esg@2025\",\"subsidiaryId\":\"$OTHER_SUB\"}" -c /tmp/e2e_sm2.jar > /dev/null
CROSS=$(curl -s --max-time 15 "$BASE/api/sm/submissions?tab=queue" -b /tmp/e2e_sm2.jar)
echo "$CROSS" | grep -q "PU-" && bad "CROSS-SCOPE LEAK: other subsidiary sees portal mirror" || ok "Cross-scope isolation holds (mirror not visible to other subsidiary)"

# ── Summary ────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════"
echo "RESULT: $PASS passed · $FAIL failed"
echo "════════════════════════════════════"
exit $FAIL
