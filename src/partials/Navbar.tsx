import {
  Logo,
  NavbarTwoColumns,
  NavMenu,
  NavMenuItem,
  Section,
} from '@/components';

const Navbar = () => (
  <Section>
    <NavbarTwoColumns>
      <a href="/" rel="noreferrer">
        <Logo
          icon={
            <svg
              className="mr-3 h-8 w-8"
              id="fi_2809425"
              enableBackground="new 0 0 24 24"
              height="128"
              viewBox="0 0 24 24"
              width="128"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="m20.832.542h-17.664c-1.448 0-2.626 1.178-2.626 2.626v17.664c0 1.448 1.178 2.626 2.626 2.626h17.664c1.448 0 2.626-1.178 2.626-2.626v-17.664c0-1.448-1.178-2.626-2.626-2.626z"
                fill="#607d8b"
              ></path>
              <path d="m4.75 18c-.192 0-.384-.073-.53-.22-.293-.293-.293-.768 0-1.061l4.719-4.719-4.719-4.72c-.293-.293-.293-.768 0-1.061s.768-.293 1.061 0l5.25 5.25c.293.293.293.768 0 1.061l-5.25 5.25c-.147.147-.339.22-.531.22z"></path>
              <path d="m21.25 24h-18.5c-1.517 0-2.75-1.233-2.75-2.75v-18.5c0-1.517 1.233-2.75 2.75-2.75h18.5c1.517 0 2.75 1.233 2.75 2.75v18.5c0 1.517-1.233 2.75-2.75 2.75zm-18.5-22.5c-.689 0-1.25.561-1.25 1.25v18.5c0 .689.561 1.25 1.25 1.25h18.5c.689 0 1.25-.561 1.25-1.25v-18.5c0-.689-.561-1.25-1.25-1.25z"></path>
              <path d="m19.25 18h-6.5c-.414 0-.75-.336-.75-.75s.336-.75.75-.75h6.5c.414 0 .75.336.75.75s-.336.75-.75.75z"></path>
            </svg>
          }
          name="Pickyzz"
        />
      </a>

      <NavMenu>
        <NavMenuItem href="/">🏠 Home</NavMenuItem>
        <NavMenuItem href="/blog">📝 Blog</NavMenuItem>
        <NavMenuItem href="/about">🧤 About</NavMenuItem>
        <NavMenuItem href="/contact">📨 Contact</NavMenuItem>
      </NavMenu>
    </NavbarTwoColumns>
  </Section>
);

export { Navbar };
