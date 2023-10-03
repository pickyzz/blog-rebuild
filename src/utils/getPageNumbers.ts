import { SITE } from "@config";

const getPageNumbers = (numberOfPosts: number) => {
  const postPerPage = Number(SITE.postPerPage);
  const numberOfPages = Math.ceil(numberOfPosts / postPerPage);

  const pageNumbers: number[] = [];
  for (let i = 1; i <= numberOfPages; i++) {
    pageNumbers.push(i);
  }

  return pageNumbers;
};

export default getPageNumbers;
