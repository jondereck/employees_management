// app/(dashboard)/[departmentId]/(routes)/clusters/office-clusters/page.tsx

import OfficeClusters from "./components/office-cluster";


export default function Page() {
  return <OfficeClusters onlyMerged={false} />;
}
