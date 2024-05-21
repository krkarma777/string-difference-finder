package com.textdifftool.web.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DiffController {

    @GetMapping
    public String diff() {
        return "diff";
    }
}
