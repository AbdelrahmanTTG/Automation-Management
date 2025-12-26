import { Javascript } from "@/Constant";
import { RootState } from "@/Redux/ReduxStore";
// import { ListOfMenuType, bookmarkedDataType } from "@/Type/SideBarType";
import Link from "next/link";
import React, { Fragment } from "react";
import { useSelector } from "react-redux";

const ListOfMenu = ({ searchArr, searchBar, input, setInput }: ListOfMenuType) => {
  const handlechnage = () => {
    setInput("");
  };

  return (
    <Fragment>
      <div className={`${input ? `Typeahead-menu custom-scrollbar is-open ` : `filled-bookmark Typeahead-menu custom-scrollbar`} `} id='search-outer'>
        {searchArr.length ? (
          searchArr.map((data: bookmarkedDataType, index: number) => {
            return (
              <div className='ProfileCard u-cf' key={index}>
                <div className='ProfileCard-avatar'>{data.icon}</div>
                <div className='ProfileCard-details'>
                  <div className='ProfileCard-realName'>
                    <Link onClick={handlechnage} href={`${data.path}`} className='realname'>
                      {data.title}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className='tt-dataset tt-dataset-0'>
            <div className='EmptyMessage'>{"Opps!! There are no result found."}</div>
          </div>
        )}
      </div>
    </Fragment>
  );
};

export default ListOfMenu;
