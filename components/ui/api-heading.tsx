
interface ApiHeadingProps {
  title: string;
  description: string
}

const ApiHeading = ({
  title,
  description
}: ApiHeadingProps) => {
  return (  
    <div className="hidden ">
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
 
export default ApiHeading;