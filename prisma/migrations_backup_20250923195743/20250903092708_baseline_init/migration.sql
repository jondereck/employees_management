-- Department ↔ Billboard
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billboard_departmentid_fkey') THEN
    ALTER TABLE "Billboard"
      ADD CONSTRAINT billboard_departmentid_fkey
      FOREIGN KEY ("departmentId") REFERENCES "Department"(id) ON DELETE RESTRICT;
  END IF;
END$$;

-- Department ↔ Offices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offices_departmentid_fkey') THEN
    ALTER TABLE "Offices"
      ADD CONSTRAINT offices_departmentid_fkey
      FOREIGN KEY ("departmentId") REFERENCES "Department"(id) ON DELETE RESTRICT;
  END IF;
END$$;

-- Billboard ↔ Offices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offices_billboardid_fkey') THEN
    ALTER TABLE "Offices"
      ADD CONSTRAINT offices_billboardid_fkey
      FOREIGN KEY ("billboardId") REFERENCES "Billboard"(id) ON DELETE RESTRICT;
  END IF;
END$$;

-- Department ↔ Employee
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_departmentid_fkey') THEN
    ALTER TABLE "Employee"
      ADD CONSTRAINT employee_departmentid_fkey
      FOREIGN KEY ("departmentId") REFERENCES "Department"(id) ON DELETE RESTRICT;
  END IF;
END$$;

-- Offices ↔ Employee (officeId)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_officeid_fkey') THEN
    ALTER TABLE "Employee"
      ADD CONSTRAINT employee_officeid_fkey
      FOREIGN KEY ("officeId") REFERENCES "Offices"(id) ON DELETE RESTRICT;
  END IF;
END$$;

-- EmployeeType ↔ Employee
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_employeetypeid_fkey') THEN
    ALTER TABLE "Employee"
      ADD CONSTRAINT employee_employeetypeid_fkey
      FOREIGN KEY ("employeeTypeId") REFERENCES "EmployeeType"(id) ON DELETE RESTRICT;
  END IF;
END$$;

-- Eligibility ↔ Employee
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_eligibilityid_fkey') THEN
    ALTER TABLE "Employee"
      ADD CONSTRAINT employee_eligibilityid_fkey
      FOREIGN KEY ("eligibilityId") REFERENCES "Eligibility"(id) ON DELETE RESTRICT;
  END IF;
END$$;

-- Designation (optional) ↔ Employee (Set NULL on delete)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_designationid_fkey') THEN
    ALTER TABLE "Employee"
      ADD CONSTRAINT employee_designationid_fkey
      FOREIGN KEY ("designationId") REFERENCES "Offices"(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Image ↔ Employee (Cascade on delete)  ← add this block **if you ran it** in Neon
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'image_employeeid_fkey') THEN
    ALTER TABLE "Image"
      ADD CONSTRAINT image_employeeid_fkey
      FOREIGN KEY ("employeeId") REFERENCES "Employee"(id) ON DELETE CASCADE;
  END IF;
END$$;
