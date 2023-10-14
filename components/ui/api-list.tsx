import { useOrigin } from "@/hooks/use-origin";
import { useParams } from "next/navigation";
import { ApiAlert } from "../api-alert";

interface ApiListProps {
  entityName: string;
  entityIdName: string;
}

const ApiList = ({
  entityName,
  entityIdName
}: ApiListProps) => {
  const params = useParams();
  const origin = useOrigin();

  const baseURL = `${origin}/api/${params.departmentId}`

  return ( 
  <>
    <ApiAlert
      title="GET"
      variant="public"
      description={`${baseURL}/${entityName}`}
    
    />
    <ApiAlert
      title="GET"
      variant="public"
      description={`${baseURL}/${entityName}/{${entityIdName}}`}
    
    />
    <ApiAlert
      title="POST"
      variant="admin"
      description={`${baseURL}/${entityName}`}
    
    />
      <ApiAlert
      title="PATCH"
      variant="admin"
      description={`${baseURL}/${entityName}/{${entityIdName}}`}
    
    />
      <ApiAlert
      title="DELETE"
      variant="admin"
      description={`${baseURL}/${entityName}/{${entityIdName}}`}
    
    />
  </> 
  );
}
 
export default ApiList;