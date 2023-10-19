/* eslint-disable no-undef */
it('index page is correct', () => {
  const page = cy.visit('/');
  
  page.get('nav').should('be.visible');
  page.get('footer').should('be.visible');
  page.get('main').children('section').should('be.visible');
  page.get('main').should('contain.id', 'main-content').should('be.visible');
  page.get('section').children('ul').should('be.visible');
  
});

it('blog page is correct', () => {
  const page = cy.visit('/blog');
  
  page.get('nav').should('be.visible');
  page.get('footer').should('be.visible');
  page.get('main').should('contain.id', 'main-content').should('be.visible');
  page.get('main').should('contain.id', 'main-content').children('ul').should('be.visible');
  
});

it('tags page is correct', () => {
  const page = cy.visit('/tags');
  
  page.get('nav').should('be.visible');
  page.get('footer').should('be.visible');
  page.get('main').should('contain.id', 'main-content').should('be.visible');
  page.get('main').should('contain.id', 'main-content').children('ul').should('be.visible');
  page.get('ul').children('li').should('be.visible')
  
});

it('guestbook page is correct', () => {
  const page = cy.visit('/guestbook');
  
  page.get('nav').should('be.visible');
  page.get('footer').should('be.visible');
  page.get('main').should('contain.id', 'main-content').should('be.visible');
  page.get('main').should('contain.id', 'main-content').children('section').should('contain.id', 'guestbook').children().should('be.visible');

});

it('about page is correct', () => {
  const page = cy.visit('/about');
  
  page.get('nav').should('be.visible');
  page.get('footer').should('be.visible');
  page.get('main').should('contain.id', 'main-content').should('be.visible');
  
});