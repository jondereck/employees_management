const Footer = () => {
  return (
    <footer className="bg-white border-t mt-1 ">
      <div className="mx-auto p-5">
        <p className="text-center text-xs text-black">
     © 2023–{new Date().getFullYear()} JDN Systems. All rights reserved.

        </p>
      </div>
    </footer>
  );
}

export default Footer;