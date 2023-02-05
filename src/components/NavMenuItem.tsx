type INavMenuItemProps = {
  href: string;
  children: string;
};

const NavMenuItem = (props: INavMenuItemProps) => (
  <li className="hover:text-gray-500">
    <button className="btn lg:btn-sm btn-xs btn-ghost">
      <a href={props.href}>{props.children}</a>
    </button>
  </li>
);

export { NavMenuItem };
