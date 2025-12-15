import React, { ReactNode, useEffect, useState } from 'react';
import { Col, Form, Input, ListGroup, ListGroupItem } from 'reactstrap';
import ListOfMenu from './ListOfMenu';
import { MENUITEMS } from '@/Data/SidebarData';
import { useDispatch } from 'react-redux';
import { getLinkItemsArray } from '@/Redux/Slices/bookmark';
import { ItemsType, searchBarType } from '@/Type/SideBarType';

const SearchBar = () => {
  const dispatch = useDispatch();
  const [input, setInput] = useState('');
  const [arr, setArr] = useState<searchBarType[]>([]);
  const [searchArr, setSearchArray] = useState<searchBarType[]>([]);

  const handlechange = (e: string) => {
    setInput(e);
    const search = arr.filter((item: any) => {
      return item.title.toLowerCase().includes(e.toLowerCase());
    });
    setSearchArray(search);
  };
  useEffect(() => {
    const suggesionArray: searchBarType[] = [];
    let num = 0;
    const getAllLink = (item: ItemsType, icon: ReactNode) => {
      if (item.children) {
        item.children.map((ele: ItemsType) => {
          getAllLink(ele, icon);
        });
      } else {
        num = num + 1;
        suggesionArray.push({ icon: icon, title: item.title, path: item.path ? item.path : '', bookmarked: false, id: num });
      }
    };

    MENUITEMS.forEach((item) => {
      item.Items?.map((child) => {
        getAllLink(child, child.icon);
      });
    });
    setArr(suggesionArray);
    dispatch(getLinkItemsArray(suggesionArray));
  }, []);

  return (
    <Col className='left-menu-header'>
      <ListGroup>
        <ListGroupItem>
          <Form className='form-inline search-form'>
            <div className='search-bg'>
              <i className='fa fa-search'></i>
              <Input value={input} onChange={(e) => handlechange(e.target.value)} name='SearchInput' className='form-control-plaintext' placeholder='Search here.....' />
            </div>
            <ListOfMenu setInput={setInput} input={input} searchBar={true} searchArr={searchArr} />
          </Form>
          <span className='d-sm-none mobile-search search-bg'></span>
        </ListGroupItem>
      </ListGroup>
    </Col>
  );
};

export default SearchBar;
