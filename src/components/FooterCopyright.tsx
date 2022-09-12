type IFooterCopyrightProps = {
    site_name: string;
  };
  
  const FooterCopyright = (props: IFooterCopyrightProps) => (
    <div className="flex justify-center border-t border-gray-400 pt-5">
      <div className="text-sm text-gray-700">
        © Copyright {new Date().getFullYear()} by {props.site_name}. Built with ♥
        and{' '}
        <a
          className="text-cyan-500 hover:underline"
          href="https://astro.build"
          target="_blank"
          rel="noopener noreferrer"
        >
          Astro
        </a>
      </div>
    </div>
  );
  
  export { FooterCopyright };