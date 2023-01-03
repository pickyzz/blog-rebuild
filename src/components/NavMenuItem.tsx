type INavMenuItemProps = {
  href: string;
  children: string;
};

const NavMenuItem = (props: INavMenuItemProps) => (
  <li className="hover:text-gray-500">
    <a href={props.href} rel='prefetch'>{props.children}</a>
  </li>
);

export { NavMenuItem };
